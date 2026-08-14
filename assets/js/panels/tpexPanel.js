import {
  renderStockPanel
} from "../ui/stockTable.js";


export function renderTpexPanel(
  root,
  stocks,
  {
    sortState,
    onSort
  }
) {

  const data =
    stocks.filter(
      stock =>
        stock.Market ===
        "TPEX"
    );


  return renderStockPanel(
    root,
    {
      data,

      statusText:
        `上櫃股票 ${data.length.toLocaleString(
          "zh-TW"
        )} 檔`,

      sortState,

      onSort,

      panelClass:
        "panel-market"
    }
  );

}
