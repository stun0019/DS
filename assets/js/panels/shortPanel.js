import {
  STRATEGY
} from "../core/config.js";

import {
  isShortCandidate
} from "../strategy/candidateRules.js";

import {
  calculateShortScore
} from "../strategy/scoring.js";

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
    [...stocks]

    .filter(
      isShortCandidate
    )

    .sort(
      (
        a,
        b
      ) =>

        calculateShortScore(
          b
        )

        -

        calculateShortScore(
          a
        )
    )

    .slice(
      0,
      STRATEGY.candidateLimit
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
