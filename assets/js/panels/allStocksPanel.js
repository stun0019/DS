import {
  renderStockPanel
} from "../ui/stockTable.js";


export function renderAllStocksPanel(
  root,
  stocks,
  {
    sortState,
    onSort
  }
) {

  const data =
    [...stocks];


  return renderStockPanel(
    root,
    {
      data,

      statusText:
        `全部市場 ${data.length.toLocaleString(
          "zh-TW"
        )} 檔`,

      sortState,

      onSort,

      panelClass:
        "panel-market"
    }
  );

}
