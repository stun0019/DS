let drawerElement = null;

let overlayElement = null;


const NAV_GROUPS = [

  {
    title:
      "隔日策略",

    items: [

      {
        view:
          "long",

        icon:
          "多",

        name:
          "做多候選池",

        description:
          "強勢股＋突破價位",

        className:
          "nav-long"
      },

      {
        view:
          "short",

        icon:
          "空",

        name:
          "做空候選池",

        description:
          "弱勢股＋跌破價位",

        className:
          "nav-short"
      },

      {
        view:
          "candidate",

        icon:
          "10",

        name:
          "成交量 TOP 10",

        description:
          "全市場券商可比成交量"
      },

      {
        view:
          "rules",

        icon:
          "規",

        name:
          "候選池規則",

        description:
          "篩選、評分與價位計算",

        className:
          "nav-rules"
      },

      {
        view:
          "replay",

        icon:
          "測",

        name:
          "Replay 回測",

        description:
          "5 分 K、LogBox 與績效",

        className:
          "nav-rules"
      }

    ]
  },


  {
    title:
      "市場資料",

    items: [

      {
        view:
          "all",

        icon:
          "全",

        name:
          "全部市場",

        description:
          "上市＋上櫃全部個股"
      },

      {
        view:
          "twse",

        icon:
          "市",

        name:
          "上市股票",

        description:
          "TWSE"
      },

      {
        view:
          "tpex",

        icon:
          "櫃",

        name:
          "上櫃股票",

        description:
          "TPEx"
      }

    ]
  }

];


function renderNavigation() {

  return NAV_GROUPS
  .map(
    group => {

      const items =
        group.items
        .map(
          item => `

            <button
              type="button"
              class="
                nav-item
                ${item.className || ""}
              "
              data-view="${item.view}"
            >

              <span class="nav-icon">
                ${item.icon}
              </span>

              <span class="nav-copy">

                <span class="nav-name">
                  ${item.name}
                </span>

                <span class="nav-description">
                  ${item.description}
                </span>

              </span>

            </button>

          `
        )
        .join("");


      return `

        <div class="drawer-section-title">
          ${group.title}
        </div>

        ${items}

      `;

    }
  )
  .join("");

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

  if (
    !drawerElement
  ) {

    return;

  }


  drawerElement
  .querySelectorAll(
    ".nav-item"
  )
  .forEach(
    button => {

      button.classList.toggle(
        "active",
        button.dataset.view ===
        view
      );

    }
  );

}


export function initDrawer(
  root,
  menuButton,
  onNavigate
) {

  root.innerHTML = `

    <div
      class="drawer-overlay"
      id="drawerOverlay"
    ></div>

    <aside
      class="drawer"
      id="drawer"
    >

      <div class="drawer-header">

        <div>

          <div class="drawer-eyebrow">
            TWSE / TPEX
          </div>

          <div class="drawer-title">
            MARKET WATCH
          </div>

        </div>

        <button
          type="button"
          class="drawer-close"
          id="drawerCloseBtn"
          aria-label="關閉選單"
        >
          ×
        </button>

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


  const closeButton =
    root.querySelector(
      "#drawerCloseBtn"
    );


  menuButton.addEventListener(
    "click",
    openDrawer
  );


  closeButton.addEventListener(
    "click",
    closeDrawer
  );


  overlayElement.addEventListener(
    "click",
    closeDrawer
  );


  drawerElement
  .querySelectorAll(
    ".nav-item"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          onNavigate(
            button.dataset.view
          );

        }
      );

    }
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
