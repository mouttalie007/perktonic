export type DiagramKind = "flowchart" | "sequence" | "er" | "gantt" | "state" | "class";

/** Starter templates, one per supported diagram type. The flowchart one is also the "Try an example" sample. */
export const TEMPLATES: Record<DiagramKind, { label: string; code: string }> = {
  flowchart: {
    label: "Flowchart",
    code: `flowchart TD
    A[Customer places order] --> B{Payment approved?}
    B -- Yes --> C[Reserve stock]
    B -- No --> D[Email payment failure]
    D --> E([End])
    C --> F{In stock?}
    F -- Yes --> G[Pack and ship]
    F -- No --> H[Create backorder]
    H --> I[Notify customer of delay]
    G --> J[Send tracking number]
    I --> J
    J --> E`,
  },
  sequence: {
    label: "Sequence diagram",
    code: `sequenceDiagram
    autonumber
    actor User
    participant App as Web app
    participant API
    participant DB as Database
    User->>App: Submit login form
    App->>API: POST /auth/login
    API->>DB: Find user by email
    DB-->>API: User record
    alt Password matches
        API-->>App: 200 + session token
        App-->>User: Show dashboard
    else Wrong password
        API-->>App: 401 Unauthorized
        App-->>User: Show error message
    end`,
  },
  er: {
    label: "ER diagram",
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : "appears in"
    CUSTOMER {
        int id PK
        string email
        string name
    }
    ORDER {
        int id PK
        int customer_id FK
        date created_at
        string status
    }
    ORDER_ITEM {
        int order_id FK
        int product_id FK
        int quantity
    }
    PRODUCT {
        int id PK
        string sku
        decimal price
    }`,
  },
  gantt: {
    label: "Gantt chart",
    code: `gantt
    title Website relaunch
    dateFormat YYYY-MM-DD
    section Discovery
    Stakeholder interviews :done, d1, 2026-11-02, 5d
    Content audit          :active, d2, after d1, 4d
    section Build
    Design system          :b1, after d2, 10d
    Page templates         :b2, after b1, 8d
    section Launch
    QA and fixes           :l1, after b2, 5d
    Go live                :milestone, l2, after l1, 0d`,
  },
  state: {
    label: "State diagram",
    code: `stateDiagram-v2
    [*] --> Draft
    Draft --> InReview : submit
    InReview --> Draft : request changes
    InReview --> Approved : approve
    Approved --> Published : publish
    Published --> Archived : archive
    Archived --> [*]`,
  },
  class: {
    label: "Class diagram",
    code: `classDiagram
    class Invoice {
        +String number
        +Date issuedOn
        +Money total()
        +markPaid()
    }
    class LineItem {
        +String description
        +int quantity
        +Money unitPrice
    }
    class Customer {
        +String name
        +String email
    }
    Customer "1" --> "*" Invoice : receives
    Invoice "1" *-- "1..*" LineItem : contains`,
  },
};

/** Code with a deliberate syntax error, used by the tests and screenshots. */
export const BROKEN_FLOWCHART = `flowchart TD
    A[Start] --> B{Valid?}
    B -- Yes --> C[Save]
    B -- No --> -->
    C --> D[Done]`;

/** Attempts to sneak script and click handlers through; strict mode must neutralise all of them. */
export const HOSTILE_FLOWCHART = `%%{init: {"securityLevel": "loose"}}%%
flowchart TD
    A["<img src=x onerror=alert(1)>Click me"] --> B["<script>alert(2)</script>"]
    click A callback "Tooltip"
    click B "javascript:alert(3)"`;
