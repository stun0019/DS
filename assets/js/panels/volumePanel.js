import {
  getTradeVolumeShares
} from "../data/stockData.js";

import {
  renderStockPanel
} from "../ui/stockTable.js";


export function renderVolumePanel(
  root,
  stocks,
  {
    sortState,
    onSort
  }
) {

  const candidates =
    [...stocks]

    .filter(
      stock =>
        getTradeVolumeShares(
          stock
        ) > 0
    )

    .sort(
      (
        a,
        b
      ) =>

        getTradeVolumeShares(
          b
        )

        -

        getTradeVolumeShares(
          a
        )
    )

    .slice(
      0,
      10
    );


  return renderStockPanel(
    root,
    {
      data:
        candidates,

      rankMode:
        true,

      statusText:
        `成交量 TOP ${candidates.length}`
        +
        "｜上市＋上櫃"
        +
        "｜券商可比成交量",

      sortState,

      onSort,

      panelClass:
        "panel-volume"
    }
  );

}
