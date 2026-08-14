export const TRADING_CALENDAR_SOURCE =
  "TWSE_OFFICIAL_HOLIDAY_SCHEDULE";


function buildValidDate(
  year,
  month,
  day
) {

  const date =
    new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day)
      )
    );


  if (
    date.getUTCFullYear() !== Number(year)
    ||
    date.getUTCMonth() !== Number(month) - 1
    ||
    date.getUTCDate() !== Number(day)
  ) {

    return null;

  }


  return (
    `${String(year).padStart(4, "0")}-`
    +
    `${String(month).padStart(2, "0")}-`
    +
    String(day).padStart(2, "0")
  );

}


export function normalizeTradingDate(
  value
) {

  const text =
    String(
      value
      ??
      ""
    )
    .trim();


  const isoMatch =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );


  if (
    isoMatch
  ) {

    return buildValidDate(
      isoMatch[1],
      isoMatch[2],
      isoMatch[3]
    );

  }


  const rocMatch =
    text.match(
      /^(\d{3})(\d{2})(\d{2})$/
    );


  if (
    rocMatch
  ) {

    return buildValidDate(
      Number(rocMatch[1]) + 1911,
      rocMatch[2],
      rocMatch[3]
    );

  }


  return null;

}


function normalizeCalendar(
  calendar
) {

  if (
    !calendar
    ||
    typeof calendar !== "object"
    ||
    calendar.source !== TRADING_CALENDAR_SOURCE
    ||
    calendar.syncStatus !== "SYNCED"
    ||
    !Array.isArray(calendar.coveredYears)
    ||
    !Array.isArray(calendar.closedDates)
    ||
    !Array.isArray(calendar.specialTradingDates)
  ) {

    return null;

  }


  const coveredYears =
    new Set(
      calendar.coveredYears.map(
        year =>
          String(year)
      )
    );


  if (
    coveredYears.size === 0
    ||
    [...coveredYears].some(
      year =>
        !/^\d{4}$/.test(year)
    )
  ) {

    return null;

  }


  const closedDates =
    calendar.closedDates.map(
      normalizeTradingDate
    );


  const specialTradingDates =
    calendar.specialTradingDates.map(
      normalizeTradingDate
    );


  if (
    closedDates.some(date => !date)
    ||
    specialTradingDates.some(date => !date)
    ||
    [...closedDates, ...specialTradingDates].some(
      date =>
        !coveredYears.has(
          date.slice(0, 4)
        )
    )
  ) {

    return null;

  }


  const closedSet =
    new Set(closedDates);

  const specialSet =
    new Set(specialTradingDates);


  if (
    [...closedSet].some(
      date =>
        specialSet.has(date)
    )
  ) {

    return null;

  }


  return {
    coveredYears,
    closedDates:
      closedSet,
    specialTradingDates:
      specialSet
  };

}


export function isTradingDate(
  value,
  calendar
) {

  const date =
    normalizeTradingDate(value);

  const normalizedCalendar =
    normalizeCalendar(calendar);


  if (
    !date
    ||
    !normalizedCalendar
    ||
    !normalizedCalendar.coveredYears.has(
      date.slice(0, 4)
    )
  ) {

    return null;

  }


  if (
    normalizedCalendar.specialTradingDates.has(date)
  ) {

    return true;

  }


  if (
    normalizedCalendar.closedDates.has(date)
  ) {

    return false;

  }


  const weekday =
    new Date(
      `${date}T00:00:00Z`
    )
    .getUTCDay();


  return (
    weekday !== 0
    &&
    weekday !== 6
  );

}


function previousCalendarDate(
  value
) {

  const date =
    new Date(
      `${value}T00:00:00Z`
    );

  date.setUTCDate(
    date.getUTCDate() - 1
  );

  return date.toISOString().slice(0, 10);

}


export function getPreviousTradingDate(
  liveSessionDate,
  holidaySchedule,
  {
    maxLookbackDays = 370
  } = {}
) {

  const sessionDate =
    normalizeTradingDate(
      liveSessionDate
    );


  if (
    !sessionDate
    ||
    isTradingDate(
      sessionDate,
      holidaySchedule
    ) !== true
  ) {

    return null;

  }


  let cursor =
    previousCalendarDate(
      sessionDate
    );


  for (
    let checkedDays = 0;
    checkedDays < maxLookbackDays;
    checkedDays += 1
  ) {

    const tradingStatus =
      isTradingDate(
        cursor,
        holidaySchedule
      );


    if (
      tradingStatus === null
    ) {

      return null;

    }


    if (
      tradingStatus
    ) {

      return cursor;

    }


    cursor =
      previousCalendarDate(
        cursor
      );

  }


  return null;

}
