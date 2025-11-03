import React from "react";
import {
  Button,
} from "@mui/material";

import './HomepageDialog.scss'

const HomepageDialog = ({ dialogOpen, setDialogOpen }) => {

     const handleDialogClose = () => {
        setDialogOpen(false)
        localStorage.setItem("welcomeDialogDismissed", "true")
    }
 
    return (

        <div className="dialog-backdrop">
            <div className="dialog-container">
                <h2 className="dialog-title">Welcome</h2>
                <p className="dialog-message">
                    The Fleet Management Proof of Concept (POC) was produced jointly by Twinit and Hitachi to showcase the flexibility and scalability of the Twinit platform and the speed at which Twinit development can occur. This POC was created based on Hitachi use cases and is the product of a single two week development sprint. As a result of the focus on delivering the defined user journeys, the POC is not a complete application and has not undergone full release testing. Features may be incomplete and issues may occur. Moving forward toward an MVP, these would be addressed.
                </p>
                <div className="dialog-actions">
                <Button 
                    onClick={handleDialogClose} 
                    variant="contained" 
                    color="primary" 
                    sx={{
                        backgroundColor: "#DF158C",
                        color: "white",
                        textTransform: "none",
                        "&:focus": {
                            backgroundColor: "#DF158C",
                        },
                        "&:hover": {
                            backgroundColor: "#C71784",
                        }
                    }}
                >
                    Accept
                </Button>
                </div>
            </div>
        </div>
    )
}

export default HomepageDialog;