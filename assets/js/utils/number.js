export function toNumber(
  value
) {

  if (
    value === null
    ||
    value === undefined
    ||
    value === ""
  ) {

    return 0;

  }


  const cleaned =
    String(
      value
    )
    .replace(
      /,/g,
      ""
    )
    .replace(
      /\+/g,
      ""
    )
    .trim();


  const number =
    Number(
      cleaned
    );


  return Number.isFinite(
    number
  )
    ? number
    : 0;

}


export function clamp(
  value,
  min,
  max
) {

  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );

}
