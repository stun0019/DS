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

            Entry Ready

          </div>

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

          V3 必須等今日開盤後形成盤中結構，

          再由今日的
          Swing Low / Swing High
          決定結構停損。

          <div class="rules-formula">

            做多：
            今日盤中結構低點
            →
            Stop

            <br><br>

            做空：
            今日盤中結構高點
            →
            Stop

          </div>

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

            TP1 = 1R

            <br>

            TP2 = 2R

          </div>

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
