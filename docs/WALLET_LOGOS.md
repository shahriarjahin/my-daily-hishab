# Brand & Wallet Identity Assets

## App Identity

- Master emblem: `backend/static/hishab-logo-v2.png` (derived from the DigitXBD family motif with rounded ledger bars and centered Taka `৳` mark), exported to `192×192`, `512×512`, iOS touch icons (`apple-touch-icon.png`), and Android launcher mipmaps.
- Developer link: [Shahriar Morshed Jahin](https://github.com/shahriarjahin) · DigitXBD.

## Wallet Icons

Wallet icons are bundled locally under `backend/static/wallet-logos/` and matched on wallet name aliases (English and বাংলা); unrecognized wallets fall back to a generic wallet glyph. Account names and balances are never transmitted to external icon services.

| Asset | Attribution / Source |
| --- | --- |
| Prime NOW | https://primenow.ai/apple-touch-icon.png |
| Prime Bank | https://www.primebank.com.bd/admin_assets/admin_images/prime_s_new.png |
| Janata Bank | https://www.jb.com.bd/assets/images/others/jblogo.png |
| bKash | Official publisher listing (`com.bKash.customerapp`) |
| Sonali Bank | Official publisher listing (`bd.com.sonalibank.sonali_home`) |
| City Bank | Official Citytouch publisher listing (`id645463050`) |

Wallet emblems are visual identifiers only; Hishab does not link directly to bank APIs or initiate payments.

## Typography

Bangla typography uses bundled Noto Sans Bengali (`backend/static/NotoSansBengali-*.ttf`) under the SIL Open Font License (`backend/static/NotoSansBengali-OFL.txt`).
