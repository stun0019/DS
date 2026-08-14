export function renderRulesPanel(
  root
) {

  root.innerHTML = `

    <section class="rules-page">

      <div class="rules-intro">

        <div class="rules-intro-title">
          隔日候選池 V2
        </div>

        <div class="rules-intro-text">

          使用前一交易日官方日線資料，
          先建立高流動性股票母池，
          再分為做多與做空候選，
          最後依強弱特徵評分並建立隔日參考價位。

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
              依日線方向與收盤位置篩選
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
              衡量收盤價位於當日區間的位置
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
              Top 10
            </div>

            <div class="rules-step-description">
              做多與做空分開排名
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
              隔日觸發
            </div>

            <div class="rules-step-description">
              使用昨日 High / Low
            </div>

          </div>

        </div>


        <div class="rules-two-column">

          <div class="rules-side long">

            <div class="rules-side-title">
              做多
            </div>

            昨日 High ＋ 1 Tick

            <br><br>

            隔日向上突破昨日最高價，
            才視為多方觸發。

          </div>


          <div class="rules-side short">

            <div class="rules-side-title">
              做空
            </div>

            昨日 Low － 1 Tick

            <br><br>

            隔日向下跌破昨日最低價，
            才視為空方觸發。

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
              防守與 TP
            </div>

            <div class="rules-step-description">
              第一版風險報酬模型
            </div>

          </div>

        </div>


        <div class="rules-content">

          防守價依昨日
          Open、Close
          與 High-Low 區間計算。

          <div class="rules-formula">

            R =
            |觸發價 - 防守價|

            <br>

            TP1 = 1R

            <br>

            TP2 = 2R

          </div>

        </div>

      </div>


      <div class="rules-warning">

        目前仍為 V2 單日模型。

        尚未納入
        5 日／20 日均量、
        ATR、
        多日趨勢、
        支撐壓力、
        籌碼與隔日即時行情。

        觸發、防守與 TP
        為技術參考，
        不是實際下單指令。

      </div>

    </section>

  `;


  return [];

}
