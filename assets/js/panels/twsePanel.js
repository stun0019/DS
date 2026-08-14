import {
  renderStockPanel
} from "../ui/stockTable.js";


export function renderTwsePanel(
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
        "TWSE"
    );


  return renderStockPanel(
    root,
    {
      data,

      statusText:
        `上市股票 ${data.length.toLocaleString(
          "zh-TW"
        )} 檔`,

      sortState,

      onSort,

      panelClass:
        "panel-market"
    }
  );

}
