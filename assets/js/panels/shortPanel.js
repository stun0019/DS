import {
  STRATEGY
} from "../core/config.js";

import {
  getShortCandidates
} from "../strategy/candidateSelector.js";

import {
  renderStockPanel
} from "../ui/stockTable.js";


export function renderShortPanel(
  root,
  stocks,
  {
    sortState,
    onSort
  }
) {

  const candidates =
    getShortPanelCandidates(
      stocks
    );


  return renderStockPanel(
    root,
    {
      data:
        candidates,

      side:
        "short",

      rankMode:
        true,

      statusText:
        `做空候選 ${candidates.length} 檔`
        +
        `｜流動性前 ${STRATEGY.liquidityPoolSize}`,

      sortState,

      onSort,

      panelClass:
        "panel-candidate panel-short"
    }
  );

}


export function getShortPanelCandidates(
  stocks
) {

  return getShortCandidates(
    stocks
  );

}
