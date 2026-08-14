export function renderRulesPanel(
  root
) {

  root.innerHTML = `

    <section class="rules-page">

      <div class="rules-intro">

        <div class="rules-intro-title">
          隔日候選池 V3.0
        </div>

        <div class="rules-intro-text">

          V3.0 將盤前與盤中正式分離。

          盤前只使用前一交易日官方資料建立候選池與觀察價。

          候選名單會先套用 TWSE / TPEx 官方當沖資格，

          做空池另排除暫停先賣後買標的。

          真正的進場、停損與停利，
          必須等今日開盤後取得盤中行情與價格結構再決定。

        </div>

      </div>


      <div class="rules-step">

        <div class="rules-step-header">

          <div class="rules-step-number">
            1
          </div>

          <div>

            <div class="rules-step-title">
              建立流動性母池
            </div>

            <div class="rules-step-description">
              上市＋上櫃依成交量排序
            </div>

          </div>

        </div>


        <div class="rules-content">

          先通過交易資格閘門：

          <strong>做多必須可現股當沖</strong>，

          <strong>做空必須同時允許先賣後買</strong>。

          資格未知或官方列為不可當沖者不進入候選池。

          系統另以 TWSE TWTBAU1 與
          TPEx tpex_intraday_trading_pre
          覆蓋當日暫停先賣後買名單。

          <br><br>

          全市場依
          <strong>券商可比成交量</strong>
          由大到小排列，

          只保留前
          <strong>120 檔</strong>
          進入候選判斷。

          <div class="rules-formula">

            TWSE =
            TotalTradeVolume
            - OddLotVolume
            - BlockTradeVolume

            <br><br>

            TPEx =
            MainboardTradeVolume
            + AfterHoursFixedVolume

          </div>

        </div>

      </div>


      <div class="rules-step">

        <div class="rules-step-header">

          <div class="rules-step-number">
            2
          </div>

          <div>

            <div class="rules-step-title">
              多空候選條件
            </div>

            <div class="rules-step-description">
              使用前一交易日日線判斷方向
            </div>

          </div>

        </div>


        <div class="rules-two-column">

          <div class="rules-side long">

            <div class="rules-side-title">
              做多候選
            </div>

            流動性排名 ≤ 120<br>

            漲跌幅 ＞ 0%<br>

            收盤價 ＞ 開盤價<br>

            收盤位置 ≥ 65%<br>

            當日振幅 ≥ 2%

          </div>


          <div class="rules-side short">

            <div class="rules-side-title">
              做空候選
            </div>

            流動性排名 ≤ 120<br>

            漲跌幅 ＜ 0%<br>

            收盤價 ＜ 開盤價<br>

            收盤位置 ≤ 35%<br>

            當日振幅 ≥ 2%

          </div>

        </div>

      </div>


      <div class="rules-step">

        <div class="rules-step-header">

          <div class="rules-step-number">
            3
          </div>

          <div>

            <div class="rules-step-title">
              收盤位置
            </div>

            <div class="rules-step-description">
              衡量收盤價位於昨日區間的位置
            </div>

          </div>

        </div>


        <div class="rules-content">

          <div class="rules-formula">

            收盤位置 =
            (Close - Low)
            /
            (High - Low)

          </div>

          越接近 100%，
          代表收盤越靠近最高價。

          <br>

          越接近 0%，
          代表收盤越靠近最低價。

        </div>

      </div>


      <div class="rules-step">

        <div class="rules-step-header">

          <div class="rules-step-number">
            4
          </div>

          <div>

            <div class="rules-step-title">
              候選分數
            </div>

            <div class="rules-step-description">
              五項因子總分 100 分
            </div>

          </div>

        </div>


        <div class="rules-content">

          <table class="rules-score-table">

            <tbody>

              <tr>
                <td>流動性排名</td>
                <td>25 分</td>
              </tr>

              <tr>
                <td>方向強度</td>
                <td>20 分</td>
              </tr>

              <tr>
                <td>K 棒實體</td>
                <td>15 分</td>
              </tr>

              <tr>
                <td>收盤位置</td>
                <td>25 分</td>
              </tr>

              <tr>
                <td>當日振幅</td>
                <td>15 分</td>
              </tr>

              <tr>
                <td>總分</td>
                <td>100 分</td>
              </tr>

            </tbody>

          </table>

        </div>

      </div>


      <div class="rules-step">

        <div class="rules-step-header">

          <div class="rules-step-number">
            5
          </div>

          <div>

            <div class="rules-step-title">
              候選 Top 10
            </div>

            <div class="rules-step-description">
              做多與做空分開排序
            </div>

          </div>

        </div>


        <div class="rules-content">

          符合條件後，
          依各自候選分數由高到低排列。

          <div class="rules-formula">

            流動性前 120
            →
            多／空條件
            →
            評分
            →
            Top 10

          </div>

        </div>

      </div>


      <div class="rules-step">

        <div class="rules-step-header">

          <div class="rules-step-number">
            6
          </div>

          <div>

            <div class="rules-step-title">
              盤前觀察價
            </div>

            <div class="rules-step-description">
              盤前只決定今天要觀察哪個位置
            </div>

          </div>

        </div>


        <div class="rules-two-column">

          <div class="rules-side long">

            <div class="rules-side-title">
              做多觀察
            </div>

            昨日 High ＋ 1 Tick

            <br><br>

            此價位只代表：

            <br>

            今日價格開始突破昨日最高價。

            <br><br>

            不代表直接買進。

          </div>


          <div class="rules-side short">

            <div class="rules-side-title">
              做空觀察
            </div>

            昨日 Low － 1 Tick

            <br><br>

            此價位只代表：

            <br>

            今日價格開始跌破昨日最低價。

            <br><br>

            不代表直接放空。

          </div>

        </div>

      </div>


      <div class="rules-step">

        <div class="rules-step-header">

          <div class="rules-step-number">
            7
          </div>

          <div>

            <div class="rules-step-title">
              今日盤中狀態
            </div>

            <div class="rules-step-description">
              V3.0 新增盤中狀態機
            </div>

          </div>

        </div>


        <div class="rules-content">

          系統將盤中行情依序分成：

          <div class="rules-formula">

            等待今日行情

            <br>
            ↓

            <br>

            觀察中

            <br>
            ↓

            <br>

            接近觀察價

            <br>
            ↓

            <br>

            已突破 / 已跌破

            <br>
            ↓

            <br>

            等待盤中結構確認

            <br>
            ↓

            <br>

            Direction Confirmation

            <br>
            ↓

            <br>

            Risk Check

            <br>
            ↓

            <br>

            Entry Ready

          </div>

          若結構成立但已設定單筆風險上限，且
          <code>maxLots = 0</code>，狀態改為
          <strong>風險超標</strong>，不得進入 Entry Ready。
          這不是 terminal state；後續行情會重新計算
          Entry、Stop 與 Risk Plan。即使
          <code>maxLots ≥ 1</code>，也必須在 blocked 後
          重新完成 Direction Confirmation 才能轉為 Entry Ready；
          單純因價格靠近 Stop 而使風險下降，不能視為進場訊號。
          風險已恢復但方向尚未確認時，狀態回到等待結構確認。

          <br><br>

          任一狀態若進入
          <strong>今日劇本失效</strong>，
          即成為該交易日的 terminal state。
          後續行情不得重新觸發，直到手動 reset
          或收到下一交易日行情才重新開始。

          <br><br>

          即時行情採嚴格時間順序：
          較舊交易日的 Quote 直接忽略；
          同一交易日若 timestamp 早於上一筆 Quote，
          也不更新狀態、K 棒、Entry、Stop 或 Risk Plan。
          只有交易日確實晚於目前狀態時，才會重設為新交易日。

          <br><br>

          現階段尚未接 Shioaji，

          因此正式行情會先顯示：

          <strong>等待今日行情</strong>。

        </div>

      </div>


      <div class="rules-step">

        <div class="rules-step-header">

          <div class="rules-step-number">
            8
          </div>

          <div>

            <div class="rules-step-title">
              Entry / Stop
            </div>

            <div class="rules-step-description">
              不再使用昨日整根日 K 決定停損
            </div>

          </div>

        </div>


        <div class="rules-content">

          V2 的：

          <div class="rules-formula">

            昨日 OHLC
            →
            直接算 Stop
            →
            TP1
            →
            TP2

          </div>

          已取消。

          <br><br>

          V3 必須先突破觀察價，

          再由突破時間之後新形成的
          Swing Low / Swing High
          決定結構停損。

          <div class="rules-formula">

            做多：
            突破後新 Swing Low
            →
            Stop

            <br><br>

            做空：
            跌破後新 Swing High
            →
            Stop

          </div>

          突破前已存在的 Swing 永遠不能作為 Stop。
          Swing 的左側、中心與右側三根 K
          都必須晚於突破時間，且明確標記為已完成。
          形成中 K 不得確認 Swing，也不得讓狀態進入 Entry Ready。

          <br><br>

          盤中結構最短週期統一為<strong>5 分 K</strong>；
          1 分 K 不得用於 Pullback、Swing、Direction Confirmation、
          Entry 或 Stop。5 分 K 必須帶可解析 timestamp 與
          <code>isComplete: true</code>；無法判定形成時間或完成狀態時，
          系統會停留在等待結構確認。

          <br><br>

          Direction Confirmation 採完全對稱規則：
          Long 必須由 Swing 形成後的新完成 5 分 K
          收盤突破前一根高點；Short 必須收盤跌破前一根低點。

        </div>

      </div>


      <div class="rules-step">

        <div class="rules-step-header">

          <div class="rules-step-number">
            9
          </div>

          <div>

            <div class="rules-step-title">
              Risk Engine
            </div>

            <div class="rules-step-description">
              有 Entry 與 Stop 後才計算風險報酬
            </div>

          </div>

        </div>


        <div class="rules-content">

          當盤中已確認：

          <br><br>

          Entry

          <br>

          Structural Stop

          <br><br>

          才開始計算：

          <div class="rules-formula">

            R =
            |Entry - Stop|

            <br><br>

            1 張價格風險 =
            R × 1000 股

            <br><br>

            1 張停損淨風險 =
            價格風險 + 月退後交易成本

            <br><br>

            1 張現金風險 =
            價格風險 + 月退前交易成本

            <br><br>

            maxLots =
            floor(單筆風險上限 ÷ 1 張現金風險)

            <br><br>

            TP1 = 扣除成本後 1R

            <br>

            TP2 = 扣除成本後 2R

          </div>

          有設定單筆風險上限時，
          <code>maxLots = 0</code> 代表一張也超過風險預算，
          UI 顯示<strong>風險超標</strong>且禁止 Entry Ready。
          未設定上限時，maxLots 保持空值，不阻擋正常訊號；
          但所有情況仍須先通過 Direction Confirmation。

        </div>

      </div>


      <div class="rules-step">

        <div class="rules-step-header">

          <div class="rules-step-number">
            10
          </div>

          <div>

            <div class="rules-step-title">
              交易成本與月退
            </div>

            <div class="rules-step-description">
              分開顯示成交當下扣款與月退後淨成本
            </div>

          </div>

        </div>


        <div class="rules-content">

          券商成交時先按原始手續費收取，
          月退 72% 後，最終等同負擔 28 折。

          <div class="rules-formula">

            原始手續費 =
            成交金額 × 0.1425%

            <br><br>

            月退後手續費 =
            原始手續費 × 0.28

            <br><br>

            月退金額 =
            原始手續費 × 0.72

            <br><br>

            當沖證交稅 =
            賣出金額 × 0.15%

          </div>

          做多由平倉賣出端課稅；
          先賣後買則由進場賣出端課稅。

          現股當沖 0.15% 優惠稅率目前施行至
          2027-12-31，屆期前需重新確認法規。

          <br><br>

          系統的保本價、TP1、TP2 與每張淨風險，
          都使用月退後淨成本計算；
          畫面另列「成交先扣成本」，提醒月退前的資金占用。

          <br><br>

          <small>
            目前依比例連續估算，未套用券商逐筆最低手續費或個別取整規則；
            實際金額仍以券商對帳單為準。
          </small>

        </div>

      </div>


      <div class="rules-step">

        <div class="rules-step-header">

          <div class="rules-step-number">
            11
          </div>

          <div>

            <div class="rules-step-title">
              Replay / Backtest
            </div>

            <div class="rules-step-description">
              逐根 5 分 K，共用正式策略核心
            </div>

          </div>

        </div>


        <div class="rules-content">

          Replay 嚴格按 09:00、09:05、09:10…逐根餵入；
          每一步只保留當下與過去 K 棒，禁止讀取未來資料。
          同一份資料重播多次必須得到完全一致的狀態、交易與績效。

          <div class="rules-formula">

            前一交易日盤後資料
            → 今日 Candidate / Observation
            → 逐根 5 分 K
            → 共用 Strategy Engine
            → Entry / Exit
            → LogBox / Performance

          </div>

          每日回測只能使用明確早於該日、且資料集指定為
          previousTradingDate 的盤後快照。Replay 頁提供今日、本週、
          自訂區間、逐筆交易、標的統計與狀態 LogBox。

        </div>

      </div>


      <div class="rules-warning">

        V3.0 已取消使用昨日 OHLC
        直接預測今日停損與 TP。

        目前盤前只提供候選股與觀察價。

        真正 Entry、Stop、TP
        必須等今日盤中行情與價格結構確認後才產生。

      </div>

    </section>

  `;


  return [];

}
