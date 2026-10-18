# Wallet identity assets

Wallet images are bundled locally. Account names or balances are never sent to a logo service.
Matching uses wallet names (English/Bangla aliases), with a generic icon for unrecognized wallets.
Cash uses a banknote symbol and is not branded as the separate Nagad service.

| Asset | Source |
| --- | --- |
| Prime NOW | https://primenow.ai/apple-touch-icon.png |
| Prime Bank | https://www.primebank.com.bd/admin_assets/admin_images/prime_s_new.png |
| Janata Bank | https://www.jb.com.bd/assets/images/others/jblogo.png |
| bKash | Official publisher listing: https://play.google.com/store/apps/details?id=com.bKash.customerapp |
| Sonali Bank | Bank emblem from the official Sonali Bank PLC publisher listing: https://play.google.com/store/apps/details?id=bd.com.sonalibank.sonali_home |
| City Bank | Citytouch identity from the official The City Bank PLC publisher listing: https://apps.apple.com/app/id645463050 |

Marks identify the user's recorded wallets; the app does not connect to these banks or initiate payments.
The Janata image is displayed with CSS clipping to show the emblem at icon size.

Language selection is stored in account settings (`en` or `bn`). Canonical categories, financial values,
wallet names and user-entered descriptions remain unchanged by UI translation. Bangla mode localizes
currency/date display and requests Bangla AI descriptions, advisor answers and budget summaries.

The header back button keeps an in-app navigation trail. Directly opened pages return to a logical
parent, and the home button is disabled when there is no prior in-app page. Dialogs also have back buttons.

Bangla typography uses the bundled Noto Sans Bengali font under the SIL Open Font License.
The full license is in `backend/static/NotoSansBengali-OFL.txt`.
