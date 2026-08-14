export function getInitialView(
  validViews
) {

  const hash =
    location.hash
    .replace(
      "#",
      ""
    )
    .trim()
    .toLowerCase();


  if (
    validViews.includes(
      hash
    )
  ) {

    return hash;

  }


  return "dashboard";

}


export function writeViewToHash(
  view
) {

  history.replaceState(
    null,
    "",
    `#${view}`
  );

}


export function bindHashNavigation(
  validViews,
  callback
) {

  window.addEventListener(
    "hashchange",
    () => {

      callback(
        getInitialView(
          validViews
        )
      );

    }
  );

}
