import {
  STRATEGY
} from "../core/config.js";

import {
  isLongCandidate
} from "../strategy/candidateRules.js";

import {
  calculateLongScore
} from "../strategy/scoring.js";

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
    [...stocks]

    .filter(
      isLongCandidate
    )

    .sort(
      (
        a,
        b
      ) =>

        calculateLongScore(
          b
        )

        -

        calculateLongScore(
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
