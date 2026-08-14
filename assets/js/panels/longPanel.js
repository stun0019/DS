import {
  STRATEGY
} from "../core/config.js";

import {
  getLongCandidates
} from "../strategy/candidateSelector.js";

import {
  renderStockPanel
} from "../ui/stockTable.js";


export function renderLongPanel(
  root,
  stocks,
  {
    sortState,
    onSort
  }
) {

  const candidates =
    getLongPanelCandidates(
      stocks
    );


  return renderStockPanel(
    root,
    {
      data:
        candidates,

      side:
        "long",

      rankMode:
        true,

      statusText:
        `做多候選 ${candidates.length} 檔`
        +
        `｜流動性前 ${STRATEGY.liquidityPoolSize}`,

      sortState,

      onSort,

      panelClass:
        "panel-candidate panel-long"
    }
  );

}


export function getLongPanelCandidates(
  stocks
) {

  return getLongCandidates(
    stocks
  );

}
