# In-Depth: Template Permissions

All permissions in Quick Model View are controlled by user group. Users only get permissions to Twinit by being added to one or more user groups.

> Remember: **Permissions on Twinit are additive**. If a user is added to multiple user groups, all actions that user takes will be governed by the super set of permissions from all user groups the user belongs to (even f they have chosen a single user in the web-client).

# Passport Permissions

| User Group | Workspaces | Everything Else |
| --- | --- | --- |
| Admin | ALL | ALL |
| Viewers | READ | NONE |

# File Service

| User Group | Files | Everything Else |
| --- | --- | --- |
| Admin | ALL | ALL |
| Viewers | READ | NONE |

# Datasources Service

| User Group | Model Import Orchestrator | Mapbox Token Orchestrator |  Everything Else |
| --- | --- | --- | --- |
| Admin | ALL | ALL | ALL |
| Viewers | NONE | READ, RUN | NONE |

For resources not listed, Admins have ALL permissions and Viewers have none.

# Item Service

## User Configs

| User Group | UserConfigs |
| --- | --- |
| Admin | ALL |
| Viewers | READ |

## Scripts

| User Group | Scripts |
| --- | --- |
| Admin | ALL |
| Viewers | NONE |

## NamedCompositeCollections

| User Group | _userType 'bim_model_version' | All Others |
| --- | --- | --- |
| Admin | ALL | ALL |
| Viewers | READ | NONE |

## NamedUserCollections

| User Group | _userType 'rvt_elements' | _userType 'rvt_element_props' | _userType 'rvt_type_elements' | _userType 'data_cache' | _userType 'bim_model_geomviews' | _userType 'bim_model_geomresources' | All Others |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Admin | ALL | ALL | ALL | ALL | ALL | ALL |  ALL | ALL | 
| Viewers | READ | READ | READ | READ | READ | READ | NONE |

For all other Item Service resources, Admins have ALL permissions and Viewers have NONE.

---
[Developer Guide](../README.md) < Back