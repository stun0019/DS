let drawerElement =
  null;

let overlayElement =
  null;


const NAV_GROUPS = [
  {
    title:
      "工作區",
    items: [
      {
        view: "dashboard",
        icon: "DB",
        name: "Dashboard",
        description: "盤後候選總覽",
        className: "nav-rules"
      },
      {
        view: "long",
        icon: "多",
        name: "Long Candidates",
        description: "多方候選與執行計畫",
        className: "nav-long"
      },
      {
        view: "short",
        icon: "空",
        name: "Short Candidates",
        description: "空方候選與執行計畫",
        className: "nav-short"
      },
      {
        view: "replay",
        icon: "5m",
        name: "Replay 回測",
        description: "歷史資料、交易與績效",
        className: "nav-rules"
      }
    ]
  },
  {
    title:
      "資料與設定",
    items: [
      {
        view: "candidate",
        icon: "10",
        name: "成交量 TOP 10",
        description: "跨市場成交量排名"
      },
      {
        view: "rules",
        icon: "規",
        name: "候選池規則",
        description: "策略規則與狀態流程",
        className: "nav-rules"
      },
      {
        view: "all",
        icon: "全",
        name: "全部市場",
        description: "上市＋上櫃全部個股"
      },
      {
        view: "twse",
        icon: "市",
        name: "上市股票",
        description: "TWSE"
      },
      {
        view: "tpex",
        icon: "櫃",
        name: "上櫃股票",
        description: "TPEx"
      }
    ]
  }
];


function renderNavigation() {

  return NAV_GROUPS.map(
    group => `
      <div class="drawer-section-title">${group.title}</div>
      ${group.items.map(
        item => `
          <button
            type="button"
            class="nav-item ${item.className ?? ""}"
            data-view="${item.view}"
          >
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-copy">
              <span class="nav-name">${item.name}</span>
              <span class="nav-description">${item.description}</span>
            </span>
          </button>
        `
      ).join("")}
    `
  ).join("");

}


export function openDrawer() {

  if (
    !drawerElement
  ) {

    return;

  }

  drawerElement.classList.add(
    "show"
  );

  overlayElement.classList.add(
    "show"
  );

  document.body.classList.add(
    "menu-open"
  );

}


export function closeDrawer() {

  if (
    !drawerElement
  ) {

    return;

  }

  drawerElement.classList.remove(
    "show"
  );

  overlayElement.classList.remove(
    "show"
  );

  document.body.classList.remove(
    "menu-open"
  );

}


export function setDrawerActive(
  view
) {

  drawerElement?.querySelectorAll(
    ".nav-item"
  )
  .forEach(
    button =>
      button.classList.toggle(
        "active",
        button.dataset.view ===
          view
      )
  );

}


export function initDrawer(
  root,
  menuButton,
  onNavigate
) {

  root.innerHTML = `
    <div class="drawer-overlay" id="drawerOverlay"></div>
    <aside class="drawer" id="drawer" aria-label="主要導覽">
      <div class="drawer-header">
        <div>
          <div class="drawer-eyebrow">TWSE / TPEX</div>
          <div class="drawer-title">MARKET TERMINAL</div>
        </div>
        <button type="button" class="drawer-close" id="drawerCloseBtn" aria-label="關閉選單">×</button>
      </div>
      ${renderNavigation()}
    </aside>
  `;

  drawerElement =
    root.querySelector(
      "#drawer"
    );

  overlayElement =
    root.querySelector(
      "#drawerOverlay"
    );

  menuButton.addEventListener(
    "click",
    openDrawer
  );

  root.querySelector(
    "#drawerCloseBtn"
  )
  .addEventListener(
    "click",
    closeDrawer
  );

  overlayElement.addEventListener(
    "click",
    closeDrawer
  );

  drawerElement.querySelectorAll(
    ".nav-item"
  )
  .forEach(
    button =>
      button.addEventListener(
        "click",
        () =>
          onNavigate(
            button.dataset.view
          )
      )
  );

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
          "Escape"
      ) {

        closeDrawer();

      }

    }
  );

}
