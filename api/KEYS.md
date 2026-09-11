# External API Keys

Values are managed by the MISO backend environment. Do not place secret values in this file.

| Variable | Purpose | Status |
|---|---|---|
| `GET_ANNI_KEY` | Public holiday lookup | Reserved for hook integration |
| `KAKAO_REST_KEY` | Kakao REST API integration | Reserved for hook integration |
| `KOPIS_KEY` | KOPIS performance information lookup | Reserved for hook integration |
| `PRK_STTUS_KEY` | Parking status API | Key storage only; no matching feature currently wired |
| `TOUR_API_KEY` | Tourism API | Key storage only; no matching feature currently wired |
| `SAFETY_API_KEY` | Disaster and safety guidance | Key storage only; no matching feature currently wired |
| `KOR_ROAD_API_KEY` | Self-driving visitor road guidance | Key storage only; no matching feature currently wired |
| `MOIVE_CHART_KEY` | KOFIC box-office anomaly detection and promotion-media recommendation | Key storage only; no matching feature currently wired |
| `GALERT_RSS` | Operator-provided alert RSS URL | Storage slot only; operator registers the source later |

External requests must run from PocketBase hooks through `_runtime_proxy.js` `proxyFetch()`.
