# Data Ingestion Pipeline — Demand Forecasting Backend

## Complete Flow Diagram

```mermaid
flowchart TD
    subgraph INPUT["INPUT DATA FORMAT"]
        A["CSV File\nFilename: Q1_2023_Q4_2024.csv\n─────────────────────\nColumns:\n• distributor_id\n• sku\n• category\n• sales (numeric)\n• year\n• quarter (1-4)\n• is_diwali / is_eid\n• is_ganesh_chaturthi\n• is_gudi_padwa\n• is_akshay_tritiya\n• is_dussehra_navratri\n• is_onam / is_christmas"]
    end

    subgraph ENTRY["ENTRY POINTS (Express Routes)"]
        B1["POST /file/upload\nfileRoutes.js:92\n(Persistent Storage + Analytics)"]
        B2["POST /forecast/upload\nforecastRoutes.js:33\n(Forecast Generation Only)"]
    end

    subgraph AUTH["AUTHENTICATION"]
        C["JWT Bearer Token\nauthMiddleware.js\nVerify & decode userId"]
    end

    subgraph RECEIVE["FILE RECEPTION"]
        D["multer — memoryStorage()\nFile buffered in RAM\nupload.single('file')"]
    end

    subgraph VALIDATE["VALIDATION LAYER"]
        E1["Filename Format Check\nfileRoutes.js:110-120\nMust match:\nQ{q}_{y}_Q{q}_{y}.csv\n4 parts when split by '_'"]
        E2["Duplicate File Check\nfileRoutes.js:101-108\nQuery GridFS for same\nfilename + userId combo"]
        E3["Extract Metadata\n• startQuarter / startYear\n• endQuarter / endYear\n• noOfQuarters =\n  (endYear-startYear)*4\n  + (endQ - startQ) + 1"]
    end

    subgraph GRIDFS_UPLOAD["GRIDFS UPLOAD (MongoDB)"]
        F["gridfsBucket.openUploadStream()\nfileRoutes.js:146-151\nBucket: 'filesBucket'\n─────────────────────\nMetadata Stored:\n• userId\n• startQuarter, startYear\n• endQuarter, endYear\n• noOfQuarters\n• timestamp\n• contentType"]
        F_EVT["uploadStream.on('finish')\nEvent trigger for\npost-upload processing"]
    end

    subgraph CSV_PARSE["CSV PARSING"]
        G1["getJSONFromGridFS(filename)\ncsvtoJson.js:4-33\nStream file from GridFS\n→ csv-parser\n→ JSON array of row objects"]
        G2["Readable.from(buffer)\nforecastRoutes.js:53\nIn-memory CSV parse\n→ csv-parser stream\n→ JSON row array"]
    end

    subgraph CHUNKING["DATA CHUNKING"]
        H["getLastNQuarters(rows)\nforecastRoutes.js:16-30\n─────────────────────\n1. Group rows by\n   distributor_id + sku\n2. Sort each group by\n   year → quarter\n3. Slice last N=4 quarters\n─────────────────────\nOutput: Map{\n  'dist1-SKU_A' → [Q1,Q2,Q3,Q4]\n  'dist1-SKU_B' → [Q1,Q2,Q3,Q4]\n  ...}\n"]
        H2["mergeUserCSVFiles(userId)\ncsvUtils.js:32-97\n─────────────────────\n1. Compute current quarter\n2. Look back 4 quarters\n3. Query GridFS for files\n   in that date range\n4. Stream + concat CSVs\n─────────────────────\nOutput: Combined CSV buffer"]
    end

    subgraph ANALYTICS_PROC["ANALYTICS PROCESSING"]
        I["performAnalytics(data)\nanalytics.js:1-71\n─────────────────────\nGroups by year_Q{quarter}\nFor each quarter computes:\n• totalSales (sum)\n• totalOrders (row count)\n• avgSalesPerOrder\n• topSKUs (top 3 by sales)\n• skuSales {sku: sales}\n• categorySales {cat: sales}\n• festivals detected (8 types)\n• previousSales (last 6 qtrs)"]
    end

    subgraph FASTAPI_CALL["ML SERVICE CALL"]
        J["POST /predict → FastAPI\nfastAPI/main.py\n─────────────────────\nPayload per group:\n{\n  distributor_id,\n  sku,\n  last_n_quarters: [\n    {sales, year, quarter,\n     festival_flags...}\n  ]\n}\n─────────────────────\nFastAPI processing:\n1. One-hot encode festivals\n2. Scale features\n3. Run LSTM model\n4. Return predicted_sales"]
    end

    subgraph STORAGE["STORAGE LAYER (MongoDB)"]
        K1["GridFS — filesBucket\n─────────────────────\nRaw CSV files stored as\nbinary chunks (255KB each)\nIndexed by filename + userId\nmetadata for range queries"]

        K2["Analytics Collection\nschema/Analytics.js\n─────────────────────\n• userId (ref: User)\n• quarter (e.g. '2024_Q1')\n• year (Number)\n• totalSales\n• totalOrders\n• avgSalesPerOrder\n• topSKUs []\n• skuSales {}\n• categorySales {}\n• festivals []\n• previousSales {}\n• createdAt / updatedAt"]

        K3["Forecast Collection\nschema/forecast.js\n─────────────────────\n• userId (ref: User)\n• year (Number)\n• quarter (Number)\n• predictions []\n  - sku (String)\n  - predicted_sales (Number)\n• createdAt / updatedAt"]

        K4["Users Collection\nschema/user.js\n─────────────────────\n• email (unique)\n• password (hashed)\n• fullName\n• isActive\n• createdAt / updatedAt"]
    end

    %% Main upload flow
    A --> B1
    A --> B2
    B1 --> C
    B2 --> C
    C --> D
    D --> E1
    E1 -->|valid| E2
    E1 -->|invalid| ERR1["400 Error\nInvalid filename format"]
    E2 -->|unique| E3
    E2 -->|duplicate| ERR2["409 Error\nFile already exists"]
    E3 --> F
    F --> K1
    F --> F_EVT

    %% Analytics path
    F_EVT --> G1
    G1 --> I
    I --> K2

    %% Forecast path
    B2 --> G2
    G2 --> CHUNKING
    H --> J
    J --> K3

    %% Merge path (used for forecast from stored files)
    K1 -.->|"GET /file/merge"| H2
    H2 -.-> H

    style INPUT fill:#1a3a5c,stroke:#4a9eff,color:#fff
    style ENTRY fill:#2d1b4e,stroke:#9b59b6,color:#fff
    style AUTH fill:#1a3a2d,stroke:#2ecc71,color:#fff
    style RECEIVE fill:#3a2d1a,stroke:#f39c12,color:#fff
    style VALIDATE fill:#3a1a1a,stroke:#e74c3c,color:#fff
    style GRIDFS_UPLOAD fill:#1a2d3a,stroke:#3498db,color:#fff
    style CSV_PARSE fill:#2d3a1a,stroke:#27ae60,color:#fff
    style CHUNKING fill:#3a1a3a,stroke:#e91e8c,color:#fff
    style ANALYTICS_PROC fill:#1a3a3a,stroke:#1abc9c,color:#fff
    style FASTAPI_CALL fill:#2a1a3a,stroke:#8e44ad,color:#fff
    style STORAGE fill:#1a1a3a,stroke:#2980b9,color:#fff
    style ERR1 fill:#5a1a1a,stroke:#e74c3c,color:#fff
    style ERR2 fill:#5a1a1a,stroke:#e74c3c,color:#fff
```

---

## Data Structure at Each Stage

```mermaid
flowchart LR
    S1["STAGE 1: Raw CSV\n─────────────\ndistributor_id,sku,category,\nsales,year,quarter,\nis_diwali,...\n─────────────\nFile on disk / HTTP body"]

    S2["STAGE 2: Buffer (RAM)\n─────────────\nUint8Array / Buffer\nentire file in memory\nvia multer memoryStorage\n─────────────\n~KB to ~MB"]

    S3["STAGE 3: GridFS Chunks\n─────────────\nMongoDB fs.files + fs.chunks\nchunkSize: 255KB\nBinary BSON data\n─────────────\nMetadata indexed separately"]

    S4["STAGE 4: JSON Array\n─────────────\n[\n  { distributor_id: 'D1',\n    sku: 'SKU_A',\n    sales: 1500,\n    year: 2024,\n    quarter: 1,\n    is_diwali: 0, ...},\n  ...\n]"]

    S5["STAGE 5: Grouped Chunks\n─────────────\nMap {\n 'D1-SKU_A': [\n  {year:2024, q:1, ...},\n  {year:2024, q:2, ...},\n  {year:2024, q:3, ...},\n  {year:2024, q:4, ...}\n ]\n}"]

    S6["STAGE 6: Analytics Doc\n─────────────\n{\n userId, quarter: '2024_Q1',\n totalSales: 45000,\n topSKUs: ['A','B','C'],\n skuSales: {A: 12000},\n festivals: ['diwali'],\n previousSales: {...}\n}"]

    S7["STAGE 7: Forecast Doc\n─────────────\n{\n userId, year: 2025,\n quarter: 1,\n predictions: [\n  {sku:'A', predicted_sales:1800},\n  {sku:'B', predicted_sales:950}\n ]\n}"]

    S1 -->|"HTTP multipart/form-data"| S2
    S2 -->|"openUploadStream()\nchunked write"| S3
    S3 -->|"getJSONFromGridFS()\nstream + csv-parser"| S4
    S4 -->|"getLastNQuarters()\ngroupBy + sort + slice"| S5
    S4 -->|"performAnalytics()\naggregation"| S6
    S5 -->|"FastAPI LSTM\npredict"| S7

    style S1 fill:#1a3a5c,stroke:#4a9eff,color:#fff
    style S2 fill:#3a2d1a,stroke:#f39c12,color:#fff
    style S3 fill:#1a2d3a,stroke:#3498db,color:#fff
    style S4 fill:#2d3a1a,stroke:#27ae60,color:#fff
    style S5 fill:#3a1a3a,stroke:#e91e8c,color:#fff
    style S6 fill:#1a3a3a,stroke:#1abc9c,color:#fff
    style S7 fill:#2a1a3a,stroke:#8e44ad,color:#fff
```

---

## GridFS Chunking Internals

```mermaid
flowchart TD
    subgraph GRIDFS["MongoDB GridFS — filesBucket"]
        direction TB
        subgraph FILES_COL["filesBucket.files collection"]
            FC["{\n  _id: ObjectId,\n  filename: 'Q1_2023_Q4_2024.csv',\n  length: 524288,\n  chunkSize: 261120,  ← 255KB\n  uploadDate: ISODate,\n  contentType: 'text/csv',\n  metadata: {\n    userId: ObjectId,\n    startQuarter: 'Q1',\n    startYear: 2023,\n    endQuarter: 'Q4',\n    endYear: 2024,\n    noOfQuarters: 8,\n    timestamp: ISODate\n  }\n}"]
        end
        subgraph CHUNKS_COL["filesBucket.chunks collection"]
            CH1["Chunk 0\n{\n  _id: ObjectId,\n  files_id: <file._id>,\n  n: 0,\n  data: BinData(0, ...)\n  ← 255KB binary\n}"]
            CH2["Chunk 1\n{\n  _id: ObjectId,\n  files_id: <file._id>,\n  n: 1,\n  data: BinData(0, ...)\n}"]
            CH3["Chunk N\n{\n  ...\n  n: N,\n  data: BinData(0, ...)\n  ← remainder\n}"]
        end
        FC -->|"files_id ref"| CH1
        FC -->|"files_id ref"| CH2
        FC -->|"files_id ref"| CH3
    end

    UPLOAD["multer Buffer\n(full file in RAM)"] -->|"openUploadStream()\nautomatically splits\ninto 255KB chunks"| FILES_COL

    DOWNLOAD["getJSONFromGridFS()\nopenDownloadStreamByName()"] -->|"reassembles chunks\nin order by n field\nstreams to csv-parser"| FILES_COL

    style GRIDFS fill:#0d1b2a,stroke:#3498db,color:#fff
    style FILES_COL fill:#1a2d3a,stroke:#3498db,color:#fff
    style CHUNKS_COL fill:#1a2a3a,stroke:#5dade2,color:#fff
    style UPLOAD fill:#3a2d1a,stroke:#f39c12,color:#fff
    style DOWNLOAD fill:#2d3a1a,stroke:#27ae60,color:#fff
```

---

## Services Architecture

```mermaid
flowchart TB
    CLIENT["Client\n(HTTP Requests)"]

    subgraph DOCKER["Docker Network: app-network"]
        subgraph NODE["Node.js Express :5000"]
            R1["POST /file/upload"]
            R2["POST /forecast/upload"]
            R3["GET /file/merge"]
            R4["GET /analytics"]
            R5["POST /user/login\nPOST /user/register"]
        end

        subgraph FASTAPI_SVC["FastAPI :8000"]
            P1["POST /predict\n(LSTM model)"]
        end

        subgraph REDIS_SVC["Redis :6379"]
            RC["Cache\n(configured,\nnot yet used\nin pipeline)"]
        end
    end

    subgraph MONGO["MongoDB Atlas (external)"]
        DB1["filesBucket.files\nfilesBucket.chunks\n(GridFS)"]
        DB2["Analytics collection"]
        DB3["Forecast collection"]
        DB4["Users collection"]
    end

    CLIENT --> NODE
    R2 -->|"HTTP POST /predict"| FASTAPI_SVC
    R3 -.->|"future caching"| REDIS_SVC
    NODE --> MONGO

    style DOCKER fill:#0d1b2a,stroke:#2980b9,color:#fff
    style NODE fill:#1a3a1a,stroke:#27ae60,color:#fff
    style FASTAPI_SVC fill:#2a1a3a,stroke:#8e44ad,color:#fff
    style REDIS_SVC fill:#3a1a1a,stroke:#e74c3c,color:#fff
    style MONGO fill:#1a2d3a,stroke:#3498db,color:#fff
```

---

## Key File Reference

| File | Role | Critical Lines |
|------|------|---------------|
| `routes/fileRoutes.js` | Upload endpoint, validation, analytics trigger | 92–191 |
| `routes/forecastRoutes.js` | Forecast upload, chunking, FastAPI call | 16–90 |
| `utils/csvtoJson.js` | GridFS → JSON conversion | 4–33 |
| `utils/csvUtils.js` | Multi-file merge (4-quarter window) | 32–97 |
| `utils/analytics.js` | Quarterly metrics computation | 1–71 |
| `config/db.js` | MongoDB + GridFS bucket init | 1–20 |
| `schema/Analytics.js` | Analytics document schema | — |
| `schema/forecast.js` | Forecast document schema | — |
| `fastAPI/main.py` | LSTM prediction service | — |
