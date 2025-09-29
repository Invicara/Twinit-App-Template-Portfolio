import React, { useState } from "react";

import EditIcon from "@material-ui/icons/Edit";
import CheckIcon from "@material-ui/icons/Check";
import InsertDriveFileIcon from "@material-ui/icons/InsertDriveFile";

import "./ViewerBottomPanel.scss";

import ActionButton from "../../../components/buttons/ActionButton";

// TODO replace this with API
const dataExample = [
    {
        "_id": "68d64f9771aa127e59875140",
        "revision status date": "2010-09-12T00:00:00Z",
        "revision status": "ISSUED",
        "equipmentId": "RCP-900-014",
        "properties": {
            "Manufacturer": {
                "val": "Westinghouse",
                "type": "string"
            },
            "Model": {
                "val": "RCP-900",
                "type": "string"
            },
            "Safety Class": {
                "val": "Class 1",
                "type": "string"
            },
            "Operating Status": {
                "val": "Operational",
                "type": "string"
            },
            "Operational Status Date": {
                "val": "2024-10-25T00:00:00Z",
                "type": "date"
            }
        },
        "revision": "001",
        "TechnicalParameters": {
            "FlowRate": {
                "val": 2100,
                "type": "number",
                "unit": "gpm"
            },
            "Power": {
                "val": 10,
                "type": "number",
                "unit": "MW"
            }
        },
        "siteEquipmentId": "RCP-A-024",
        "equipmentType": "Pump"
    },
    {
        "_id": "68d64f9771aa127e59875142",
        "revision status date": "2019-11-28T00:00:00Z",
        "revision status": "ISSUED",
        "equipmentId": "RCP-900-011",
        "properties": {
            "Manufacturer": {
                "val": "KSB",
                "type": "string"
            },
            "Model": {
                "val": "RSR",
                "type": "string"
            },
            "Safety Class": {
                "val": "Class 1",
                "type": "string"
            },
            "Operating Status": {
                "val": "Operational",
                "type": "string"
            },
            "Operational Status Date": {
                "val": "2024-10-25T00:00:00Z",
                "type": "date"
            }
        },
        "revision": "002",
        "TechnicalParameters": {
            "FlowRate": {
                "val": 2800,
                "type": "number",
                "unit": "gpm"
            },
            "Power": {
                "val": 18,
                "type": "number",
                "unit": "MW"
            }
        },
        "siteEquipmentId": "RCP-A-021",
        "equipmentType": "Pump"
    },
    {
        "_id": "68d64f9771aa127e59875143",
        "revision status date": "2019-11-28T00:00:00Z",
        "revision status": "ISSUED",
        "equipmentId": "RCP-900-012",
        "properties": {
            "Manufacturer": {
                "val": "KSB",
                "type": "string"
            },
            "Model": {
                "val": "RSR",
                "type": "string"
            },
            "Safety Class": {
                "val": "Class 1",
                "type": "string"
            },
            "Operating Status": {
                "val": "Operational",
                "type": "string"
            },
            "Operational Status Date": {
                "val": "2024-10-25T00:00:00Z",
                "type": "date"
            }
        },
        "revision": "002",
        "TechnicalParameters": {
            "FlowRate": {
                "val": 2800,
                "type": "number",
                "unit": "gpm"
            },
            "Power": {
                "val": 18,
                "type": "number",
                "unit": "MW"
            }
        },
        "siteEquipmentId": "RCP-A-022",
        "equipmentType": "Pump"
    }
]


const ViewerBottomPanel = ({ isBottomECPanelOpen }) => {
  const [properties, setProperties] = useState(
    dataExample.map((p) => ({ ...p, isEditing: false }))
  );

  // Toggle edit mode for a single panel
  const toggleEdit = (index) => {
    setProperties((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, isEditing: !p.isEditing } : p
      )
    );
  };

  // Handle field changes per property panel
  const handleChange = (index, field, value) => {
    setProperties((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      )
    );
  };

  return (
    <>
      {isBottomECPanelOpen ? (
        <div className="viewer-bottom-panel">
          <div className="viewer-bottom-panel-inner">
            {properties.map((prop, index) => (
              <div className="panel-item" key={prop._id}>
                <div 
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 16px 0px 16px",
                  }}
                >
                  {/* // TODO double check that this is the correct value */}
                  <p>{`Current properties: ${prop.siteEquipmentId}`}</p>

                  {!prop.isEditing ? (
                    <ActionButton title="Edit">
                      <div className="edit-action-button" onClick={() => toggleEdit(index)}>
                        <EditIcon style={{height: "16px", width: "16px", marginRight: "8px"}}
                        />
                        <p>Edit</p>
                      </div>
                    </ActionButton>
                  ) : (
                    <ActionButton title="Save">
                      <div className="edit-action-button" onClick={() => toggleEdit(index)}>
                        <CheckIcon style={{height: "16px", width: "16px", marginRight: "8px"}}
                        />
                        <p>Save</p>
                      </div>
                    </ActionButton>
                  )}

                            {/* For Use Case 03 */}
                  {/* <ActionButton title="Edit Request">
                    <div className="edit-req-action-buton">
                      <span className="req-num">Edit Request(2)</span>
                      <span>Reject</span>
                      <span className="seperator-icon">|</span>
                      <span>Approve</span>
                      <InsertDriveFileIcon />
                    </div>
                  </ActionButton> */}
                </div>

                <div className="property-container">
                  <Property
                    editable={prop.isEditing}
                    label="Name ID"
                    value={prop.siteEquipmentId}
                    onChange={(val) => handleChange(index, "id", val)}
                  />
                  <Property
                    editable={prop.isEditing}
                    label="Model"
                    value={prop.properties.Model.val}
                    onChange={(val) => handleChange(index, "model", val)}
                  />
                  <Property
                    editable={prop.isEditing}
                    label="Equipment Type"
                    value={prop.equipmentType}
                    onChange={(val) => handleChange(index, "type", val)}
                  />
                  <Property
                    editable={prop.isEditing}
                    label="Manufacturer"
                    value={prop.properties.Manufacturer.val}
                    onChange={(val) => handleChange(index, "manufacturer", val)}
                  />
                  <Property
                    editable={prop.isEditing}
                    label="Safety Class"
                    value={prop.properties['Safety Class'].val}
                    onChange={(val) => handleChange(index, "safetyClass", val)}
                  />
                  <Property
                    editable={prop.isEditing}
                    label="Flow Rate"
                    value={prop.TechnicalParameters.FlowRate.val}
                    onChange={(val) => handleChange(index, "flowRate", val)}
                  />
                  <Property
                    editable={prop.isEditing}
                    label="Power"
                    value={prop.TechnicalParameters.Power.val}
                    onChange={(val) => handleChange(index, "power", val)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
};

export default ViewerBottomPanel;

function Property({ label, value, editable, onChange }) {
  return (
    <div className="property-row" style={{borderBottom: editable ? '1px solid #EE67B8' : '1px solid #eee'}}>
      <span className="label">
        {label}
      </span>
      {editable ? (
        <input
          type="text"
          className="value-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <span className="value">
          {value}
        </span>
      )}
    </div>
  );
}
