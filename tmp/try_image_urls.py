import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver bed catalog)"}
BASE = "https://stevesilver.com/wp-content/uploads"
CANDIDATES = [
    f"{BASE}/2024/09/SteveSilverFurniture__Burlington_BUR520N-TTTB_WS2.jpg",
    f"{BASE}/2024/09/SteveSilverFurniture_Burlington_BUR520N-TTTB_WS2.jpg",
    f"{BASE}/2024/09/SteveSilverFurniture__Burlington_BUR520N-TTTB_WS1.jpg",
    f"{BASE}/2021/09/SteveSilverCo_Burlington_BUR520N-TTTB_WS2.jpg",
    f"{BASE}/2022/05/SteveSilverFurniture_Grayson_GS600GSV_WS2.jpg",
    f"{BASE}/2022/05/SteveSilverFurniture_Fortuna_FT850LC_WS2.jpg",
    f"{BASE}/2021/11/SteveSilverFurniture_Fortuna_FT850LC_WS2.jpg",
    f"{BASE}/2022/07/SteveSilverFurniture_Fortuna_FT850LC_WS2.jpg",
    f"{BASE}/2021/09/SteveSilverFurniture_Laurel_LL950CLG_WS2.jpg",
    f"{BASE}/2022/05/SteveSilverFurniture_Laurel_LL950CLG_WS2.jpg",
    f"{BASE}/2023/02/SteveSilverFurniture_Fitzgerald_FTZ100C_WS2.jpg",
    f"{BASE}/2023/04/SteveSilverFurniture_Garcia_GA500SB_WS2.jpg",
    f"{BASE}/2023/05/SteveSilverFurniture_ParkCity_PC900SEC_WS2.jpg",
    f"{BASE}/2023/08/SteveSilverFurniture_Karina_KA500SV_WS2.jpg",
    f"{BASE}/2022/06/Costco_Driftwood_Molly_MY5454T_WS2.jpg",
    f"{BASE}/2022/07/SteveSilverFurniture_Adeline_ADL500AC_WS2.jpg",
    f"{BASE}/2023/01/SteveSilverFurniture_Lovell_LV100S_WS2.jpg",
    f"{BASE}/2021/09/SteveSilverFurniture_Natalia_NT950CL_WS2.jpg",
]
for url in CANDIDATES:
    try:
        req = urllib.request.Request(url, headers=UA)
        data = urllib.request.urlopen(req, timeout=20).read()
        print("OK", len(data), url.rsplit("/", 1)[-1])
    except Exception as exc:
        print("NO", url.rsplit("/", 1)[-1], exc)
