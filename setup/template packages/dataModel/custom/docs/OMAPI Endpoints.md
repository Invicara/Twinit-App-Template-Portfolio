# API Documentation

## /references
### `POST /references/search`
#### Description:
Search for Reference Equipment

#### Body parameters:
- `unitType`: The unit type of the equipment's reactor
  - Type: string
  - Example: `900 MW`

- `systemId`: The identifier for the system
  - Type: string
  - Example: `RCS`

- `equipmentType`: The type description
  - Type: string
  - Example: `Pump (Reference)`

- `equipmentId`: Unique equipment indentifier
  - Type: string
  - Example: `RCP-900-011`

- `_pageSize_`: Limit the number items to return
  - Type: number
  - Example: `100`

- `_offset_`: Page offset of returned items
  - Type: number
  - Example: `0`

### `GET /references/unittypes`
#### Description:
Get a list of distinct unit types
#### Response example:
```
{
  "unitTypes": [
    "900 MW"
  ]
}
```

### `GET /references/unittypes/:unitType/systems`
#### Description:
Get reference systems by unit type

#### URL parameters:
- `unitType`: The unit type of the equipment's reactor
  - Type: string
  - Example: `900 MW`

#### Response example:
```
{
  "unitType": "900 MW",
  "systemIds": [
    "FW",
    "RCS",
    "SS",
    "TS"
  ]
}
```

### `GET /references/unittypes/:unitType/systems/:systemId/equipmenttypes`
#### Description:
Get reference equipment types

#### URL parameters:
- `unitType`: The unit type of the equipment's reactor
  - Type: string
  - Example: `900 MW`

- `systemId`: The identifier for the system
  - Type: string
  - Example: `RCS`

#### Response example:
```
{
    "unitType": "900 MW",
    "systemId": "RCS",
    "equipmentTypes": [
      "Pump"
    ]
}
```

### `GET /references/unittypes/:unitType/systems/:systemId/equipmenttypes/:equipmentType/equipment`
#### Description:
Get reference equipment

#### URL parameters:
- `unitType`: The unit type of the equipment's reactor
  - Type: string
  - Example: `900 MW`

- `systemId`: The identifier for the system
  - Type: string
  - Example: `RCS`

- `equipmentType`: The type description
  - Type: string
  - Example: `Pump (Reference)`

#### Response example:
```
{
  "unitType": "900 MW",
  "systemId": "RCS",
  "Equipment Id": "RCP-900-011",
  "Equipment Name": "Reactor Coolant Pump 900MW",
  "equipmentType": "Pump",
  "tipRevision": "002",
  "revisions": {
    "_list": [
      {
        "revision": "000",
        "revision status date": "2005-08-31T00:00:00Z",
        "revision status": "REVISED",
        "equipmentId": "RCP-900-011",
        "properties": [
          {
            "val": "Westinghouse",
            "name": "Manufacturer",
            "type": "string"
          },
          {
            "val": "RCP-900",
            "name": "Model",
            "type": "string"
          },
          {
            "val": "Class 1",
            "name": "Safety Class",
            "type": "string"
          },
          {
            "val": "Operational",
            "name": "Operating Status",
            "type": "string"
          },
          {
            "val": "2005-08-31T00:00:00Z",
            "name": "Operational Status Date",
            "type": "date"
          }
        ],
        "TechnicalParameters": [
          {
            "val": 2000,
            "unit": "gpm",
            "name": "FlowRate",
            "type": "number"
          },
          {
            "val": 10,
            "unit": "MW",
            "name": "Power",
            "type": "number"
          }
        ]
      }
    ]
  }
}
```

## /siteequip
### `POST /siteequip/search`
#### Description:
Search for Site Equipment

#### Body parameters:
- `systemId`: The identifier for the system
  - Type: string
  - Example: `RCS`

- `equipmentType`: The type description
  - Type: string
  - Example: `Pump (Reference)`

- `equipmentId`: Unique equipment indentifier
  - Type: string
  - Example: `RCP-900-011`

- `_pageSize_`: Limit the number items to return
  - Type: number
  - Example: `100`

- `_offset_`: Page offset of returned items
  - Type: number
  - Example: `0`

### `GET /siteequip/facilities`
#### Description:
Get site facilities

#### Response example:
```
{
  "facilities": [
    "A",
    "B"
  ]
}
```

### `GET /siteequip/facilities/:facility/units`
#### Description:
Get list of site facility units

#### URL parameters:
- `facility`: The facility identifier
  - Type: string
  - Example: `FCA`

#### Response example:
```
{
  "facility": "A",
  "units": [
    "01",
    "02"
  ]
}
```

### `GET /siteequip/facilities/:facility/units/:unit/systems`
#### Description:
Get list of site facility units

#### URL parameters:
- `facility`: The facility identifier
  - Type: string
  - Example: `FCA`

- `unit`: The unit identifier
  - Type: string
  - Example: `01`

#### Response example:
```
{
  "facility": "B",
  "unit": "02",
  "systemIds": [
    "FW",
    "RCS",
    "SS",
    "TS"
  ]
}
```

### `GET /siteequip/facilities/:facility/units/:unit/systems/:systemId/equipmenttypes`
#### Description:
Get list of site facility units

#### URL parameters:
- `facility`: The facility identifier
  - Type: string
  - Example: `FCA`

- `unit`: The unit identifier
  - Type: string
  - Example: `01`

- `systemId`: The identifier for the system
  - Type: string
  - Example: `RCS`

#### Response example:
```
{
  "facility": "B",
  "unit": "02",
  "systemId": "RCS",
  "equipmentTypes": [
    "Pump"
  ]
}
```

### `GET /siteequip/facilities/:facility/units/:unit/systems/:systemId/equipmenttypes/:equipmentType/equipment`
#### Description:
Get list of site facility units

#### URL parameters:
- `facility`: The facility identifier
  - Type: string
  - Example: `FCA`

- `unit`: The unit identifier
  - Type: string
  - Example: `01`

- `systemId`: The identifier for the system
  - Type: string
  - Example: `RCS`

- `equipmentType`: The equipment type description
  - Type: string
  - Example: `Pump`

#### Response example:
```
{
  "facility": "B",
  "unit": "02",
  "systemId": "RCS",
  "equipmentType": "Pump",
  "equipment": {
    "_list": [
      {
        "unitType": "900 MW",
        "systemId": "RCS",
        "Equipment Id": "RCP-900-011",
        "Equipment Name": "Reactor Coolant Pump 900MW",
        "equipmentType": "Pump",
        "Site Equipment Id": "RCP-B-021",
        "tipRevision": "001",
        "revisions": {
          "revision": "000",
          "revision status date": "2008-03-16T00:00:00Z",
          "revision status": "REVISED",
          "equipmentId": "RCP-900-011",
          "properties": [
            {
                "val": "Westinghouse",
                "name": "Manufacturer",
                "type": "string"
            },
            {
                "val": "RCP-900",
                "name": "Model",
                "type": "string"
            },
            {
                "val": "Class 1",
                "name": "Safety Class",
                "type": "string"
            },
            {
                "val": "Operational",
                "name": "Operating Status",
                "type": "string"
            },
            {
                "val": "2025-01-22T00:00:00Z",
                "name": "Operational Status Date",
                "type": "date"
            }
          ],
          
          "TechnicalParameters": [
            {
                "val": 2000,
                "unit": "gpm",
                "name": "FlowRate",
                "type": "number"
            },
            {
                "val": 10,
                "unit": "MW",
                "name": "Power",
                "type": "number"
            }
          ]
        }
      }
    ]
  }
}
```
### `GET /siteequip/facilities/:facility/units/:unit/systems/:systemId`
#### Description:
Get list of equipment by facility, unit and system

#### URL parameters:
- `facility`: The facility identifier
  - Type: string
  - Example: `FCA`

- `unit`: The unit identifier
  - Type: string
  - Example: `01`

- `systemId`: The identifier for the system
  - Type: string
  - Example: `RCS`

#### Response example:
```
{
  "facility": "B",
  "unit": "02",
  "systemId": "RCS",
  "equipment": {
    "_pageSize": 4,
    "_list": [
      ...
      {
        "unitType": "900 MW",
        "systemId": "RCS",
        "Equipment Id": "RCP-900-011",
        "Equipment Name": "Reactor Coolant Pump 900MW",
        "Site Equipment Id": "RCP-B-021",
        "tipRevision": "001",
        "revisions": {
          "_pageSize": 2,
          "_list": [
            ...
            {
              "revision status date": "2008-03-16T00:00:00Z",
              "revision status": "REVISED",
              "_id": "68dfe26456dd1014cc0941c5",
              "_metadata": {
                "_updatedById": "6ae13743-a90f-4b74-8252-a16ca47cd14e",
                "_createdAt": 1759502948578,
                "_createdById": "6ae13743-a90f-4b74-8252-a16ca47cd14e",
                "_updatedAt": 1759502948578
              },
              "equipmentId": "RCP-900-011",
              "properties": [
                {
                  "val": "Westinghouse",
                  "name": "Manufacturer",
                  "type": "string"
                },
                {
                  "val": "RCP-900",
                  "name": "Model",
                  "type": "string"
                },
                {
                  "val": "Class 1",
                  "name": "Safety Class",
                  "type": "string"
                },
                {
                  "val": "Operational",
                  "name": "Operating Status",
                  "type": "string"
                },
                {
                  "val": "2025-01-22T00:00:00Z",
                  "name": "Operational Status Date",
                  "type": "date"
                }
              ],
              "revision": "000",
              "TechnicalParameters": [
                {
                  "val": 2000,
                  "unit": "gpm",
                  "name": "FlowRate",
                  "type": "number"
                },
                {
                  "val": 10,
                  "unit": "MW",
                  "name": "Power",
                  "type": "number"
                }
              ]
            }
            ...
          ],
          "_offset": 0,
          "_total": 2
        },
        "equipmentType": "Pump"
      }
      ...
    ],
    "_offset": 0,
    "_total": 4
  }
}
```

### `GET /siteequip/facilities/:facility/units/:unit/equipments/:siteEquipmentId/ecs`
#### Description:
Gets related engineering changes and their log entries 

#### URL parameters:
- `facility`: The facility identifier
  - Type: string
  - Example: `A`

- `unit`: The unit identifier
  - Type: string
  - Example: `01`

- `siteEquipmentId`: The identifier for the site equipment
  - Type: string
  - Example: `RCP-A-011`

#### Query string parameters:
- `openEcs`: Returns only engineering changes that are open
  - Type: string
  - Example: `true`

#### Response example:
```
{
  "ecsWithLogs": [
    {
      "id": "001",
      "type": "TechnicalParameters",
      "title": "Adjusted flow rate by +100 gpm",
      "logs": {
        "_pageSize": 3,
        "_list": [
          {
            "Base Revision": "000",
            "Equipment Revision": "000A",
            "dateImplemented": "",
            "site": "A",
            "unit": "01",
            "Equipment Id": "RCP-900-011",
            "Site Equipment Id": "RCP-A-011",
            "dateProposed": "2010-07-18T00:00:00Z",
            "ecid": "001",
            "dateReviewed": "",
            "status": "REGISTERED",
            "username": "Bob"
          },
          {
            "Base Revision": "000",
            "Equipment Revision": "000A",
            "dateImplemented": "",
            "site": "A",
            "unit": "01",
            "Equipment Id": "RCP-900-011",
            "Site Equipment Id": "RCP-A-011",
            "dateProposed": "2010-07-18T00:00:00Z",
            "ecid": "001",
            "dateReviewed": "2010-08-25T00:00:00Z",
            "status": "APPROVED",
            "username": "Alice"
          },
          {
            "Base Revision": "000",
            "Equipment Revision": "001",
            "dateImplemented": "2010-09-01T00:00:00Z",
            "site": "A",
            "unit": "01",
            "Equipment Id": "RCP-900-011",
            "Site Equipment Id": "RCP-A-011",
            "dateProposed": "2010-07-18T00:00:00Z",
            "ecid": "001",
            "dateReviewed": "2010-08-25T00:00:00Z",
            "status": "CLOSED",
            "username": "Charlie"
          }
        ],
        "_offset": 0,
        "_total": 3
      }
    }
  ]
}
```

### `GET /siteequip/facilities/:facility/units/:unit/equipments/ecs`
#### Description:
Gets related engineering changes and their log entries 

#### URL parameters:
- `facility`: The facility identifier
  - Type: string
  - Example: `A`

- `unit`: The unit identifier
  - Type: string
  - Example: `01`

#### Query string parameters:
- `ids`: Comma separated list of site equipment IDs
  - Type: string
  - Example: `RCP-A-011,RCP-A-012,RCP-A-013,RCP-A-014`

- `openEcs`: Returns only engineering changes that are open
  - Type: string
  - Example: `true`

#### Response example:
```
{
  "siteEquipsWithEcs": [
    ...
    {
      "unitType": "900 MW",
      "systemId": "RCS",
      "Equipment Id": "RCP-900-011",
      "Equipment Name": "Reactor Coolant Pump 900MW",
      "Site Equipment Id": "RCP-B-011",
      "tipRevision": "001",
      "equipmentType": "Pump",
      "ecsWithLogs": [
        {
          "id": "001",
          "type": "TechnicalParameters",
          "title": "Adjusted flow rate by +100 gpm",
          "logs": {
            "_pageSize": 3,
            "_list": [
              {
                "Base Revision": "000",
                "Equipment Revision": "000A",
                "dateImplemented": "",
                "site": "B",
                "unit": "01",
                "Equipment Id": "RCP-900-011",
                "Site Equipment Id": "RCP-B-011",
                "dateProposed": "2010-07-18T00:00:00Z",
                "ecid": "001",
                "dateReviewed": "",
                "status": "REGISTERED",
                "username": "Bob"
              },
              {
                "Base Revision": "000",
                "Equipment Revision": "000A",
                "dateImplemented": "",
                "site": "B",
                "unit": "01",
                "Equipment Id": "RCP-900-011",
                "Site Equipment Id": "RCP-B-011",
                "dateProposed": "2010-07-18T00:00:00Z",
                "ecid": "001",
                "dateReviewed": "2011-02-13T00:00:00Z",
                "status": "APPROVED",
                "username": "v"
              },
              {
                "Base Revision": "000",
                "Equipment Revision": "001",
                "dateImplemented": "2011-03-15T00:00:00Z",
                "site": "B",
                "unit": "01",
                "Equipment Id": "RCP-900-011",
                "Site Equipment Id": "RCP-B-011",
                "dateProposed": "2010-07-18T00:00:00Z",
                "ecid": "001",
                "dateReviewed": "2011-02-13T00:00:00Z",
                "status": "CLOSED",
                "username": "Rob"
              }
            ],
            "_offset": 0,
            "_total": 3
          }
        },
        {
          "dateProposed": "2025-01-26T00:00:00Z",
          "id": "004",
          "type": "Equipment Change/Redesign",
          "title": "Replace RCP with KSB RSR Model",
          "logs": {
            "_pageSize": 1,
            "_list": [
              {
                "Base Revision": "001",
                "Equipment Revision": "001A",
                "dateImplemented": "",
                "site": "B",
                "unit": "01",
                "Equipment Id": "RCP-900-011",
                "Site Equipment Id": "RCP-B-011",
                "dateProposed": "2025-01-26T00:00:00Z",
                "ecid": "004",
                "dateReviewed": "",
                "status": "REGISTERED",
                "username": "Bob"
              }
            ],
            "_offset": 0,
            "_total": 1
          }
        }
      ]
    },
    ...
  ]
}
```

### `POST /siteequip/pendingrevision`
#### Description:
* Creates a pending/intermedate revision for site equipment if it is valid in an open EC
* Increments the revision number to XXXA
* Updates the tip revision on the site equipment item
* Creates an EC entry with status of APPROVED

#### Body parameters:
- `facility`: The facility ID
  - Type: string
  - Example: `A`

- `unit`: The unit ID
  - Type: string
  - Example: `02`

- `equipmentId`: The reference equipment ID
  - Type: string
  - Example: `RCP-900-011`

- `siteEquipmentId`: The site equipment ID
  - Type: string
  - Example: `RCP-A-021`

- `properties`: Site requirement properties (all values to be stored including both edited and unedited values)
  - Type: array<object>
  - Example: `[..,{ "val": "Class 1", "name": "Safety Class", "type": "string" },...]`

- `TechnicalParameters`: Site equipment technical parameters (all values to be stored including both edited and unedited values)
  - Type: array<object>
  - Example: `[...,{ "val": 2000, "unit": "gpm", "name": "FlowRate", "type": "number" },...]`

- `username`: The user name of the person making edits to site equipment
  - Type: string
  - Example: `Bob`

### `POST /siteequip/approvedrevision`
#### Description:
* Moves site equipment to major revision e.g. 000A -> 001
* Sets previous site equipment revisions to REVISED status
* Updates intermediate revision to ISSUED status
* Creates new EC entry with CLOSED status

#### Body parameters:
- `facility`: The facility ID
  - Type: string
  - Example: `A`

- `unit`: The unit ID
  - Type: string
  - Example: `02`

- `siteEquipmentId`: The site equipment ID
  - Type: string
  - Example: `RCP-A-021`

- `revision`: The pending revision number
  - Type: string
  - Example: `001A`

- `username`: The user name of the person making edits to site equipment
  - Type: string
  - Example: `Bob`

### `DELETE /siteequip/facilities/:facility/units/:unit/siteequipment/:siteEquipmentId/revisions/:revision/pendingrevision`
#### Description:
* Deletes intermediate site equipment revision
* Sets tip on site equipment item back to previous revision e.g 002A -> 002
* Deletes EC entry with APPROVED status for the related site requipment

#### URL parameters:
- `ecid`: The Engineering Change ID
  - Type: string
  - Example: `002`

- `facility`: The facility ID
  - Type: string
  - Example: `A`

- `unit`: The unit ID
  - Type: string
  - Example: `02`

- `siteEquipmentId`: The site equipment ID
  - Type: string
  - Example: `RCP-A-021`

- `revision`: The pending revision number
  - Type: string
  - Example: `001A`


## /engineeringchanges
### `GET /engineeringchanges`
#### Description:
Gets all engineering changes. Includes latest updated EC log entries grouped by Site Equipment. Tallied counts of different site equipment EC statuses. Last updated log entry date.

#### Response example:
```
{
  ecs: [
    {
      "id": "001",
      "type": "TechnicalParameters",
      "title": "Adjusted flow rate by +100 gpm",
      "lastDateReviewed": "2011-02-13T00:00:00Z",
      "status": {
        "REGISTERED": 0,
        "APPROVED": 0,
        "CLOSED": 16
      },
      logs: {
        "RCP-A-011": {
          "Base Revision": "000",
          "Equipment Revision": "001",
          "dateImplemented": "2010-09-01T00:00:00Z",
          "site": "A",
          "unit": "01",
          "Equipment Id": "RCP-900-011",
          "Site Equipment Id": "RCP-A-011",
          "dateProposed": "2010-07-18T00:00:00Z",
          "ecid": "001",
          "dateReviewed": "2010-08-25T00:00:00Z",
          "status": "CLOSED",
          "username": "Charlie"
      },
      "RCP-A-012": {
          "Base Revision": "000",
          "Equipment Revision": "001",
          "dateImplemented": "2010-09-01T00:00:00Z",
          "site": "A",
          "unit": "01",
          "Equipment Id": "RCP-900-012",
          "Site Equipment Id": "RCP-A-012",
          "dateProposed": "2010-07-18T00:00:00Z",
          "ecid": "001",
          "dateReviewed": "2010-08-25T00:00:00Z",
          "status": "CLOSED",
          "username": "Charlie"
      },
      }
    }
  ]
}
```

### `GET /engineeringchanges/:ecid`
#### Description:
Gets engineering changes by EC ID. Includes latest updated EC log entries grouped by Site Equipment. Tallied counts of different site equipment EC statuses. Last updated log entry date.

#### URL parameters:
- `ecid`: The EC ID
  - Type: string
  - Example: `002`

### `GET /engineeringchanges/:ecid/logs`
#### Description:
Gets history of engineering change log entries by EC ID.

#### URL parameters:
- `ecid`: The EC ID
  - Type: string
  - Example: `002`

#### Response example:
```
{
  "ecLogs": [
    {
      "Base Revision": "000",
      "Equipment Revision": "000A",
      "dateImplemented": "",
      "site": "A",
      "unit": "01",
      "Equipment Id": "RCP-900-011",
      "Site Equipment Id": "RCP-A-011",
      "dateProposed": "2010-07-18T00:00:00Z",
      "ecid": "001",
      "dateReviewed": "",
      "status": "REGISTERED",
      "username": "Bob"
    },
    {
      "Base Revision": "000",
      "Equipment Revision": "000A",
      "dateImplemented": "",
      "site": "A",
      "unit": "01",
      "Equipment Id": "RCP-900-011",
      "Site Equipment Id": "RCP-A-011",
      "dateProposed": "2010-07-18T00:00:00Z",
      "ecid": "001",
      "dateReviewed": "2010-08-25T00:00:00Z",
      "status": "APPROVED",
      "username": "Alice"
    }
  ]
}
```