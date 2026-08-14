export function getPriceTick(
  price
) {

  if (
    price < 10
  ) {

    return 0.01;

  }


  if (
    price < 50
  ) {

    return 0.05;

  }


  if (
    price < 100
  ) {

    return 0.1;

  }


  if (
    price < 500
  ) {

    return 0.5;

  }


  if (
    price < 1000
  ) {

    return 1;

  }


  return 5;

}


export function roundToTick(
  price,
  direction = "nearest"
) {

  if (
    price <= 0
  ) {

    return 0;

  }


  const tick =
    getPriceTick(
      price
    );


  const units =
    price
    /
    tick;


  let rounded;


  if (
    direction ===
    "up"
  ) {

    rounded =
      Math.ceil(
        units
        -
        1e-9
      );

  }

  else if (
    direction ===
    "down"
  ) {

    rounded =
      Math.floor(
        units
        +
        1e-9
      );

  }

  else {

    rounded =
      Math.round(
        units
      );

  }


  return Number(
    (
      rounded
      *
      tick
    )
    .toFixed(
      2
    )
  );

}
