import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";


const HomepageDialog = ({ dialogOpen, setDialogOpen }) => {

     const handleDialogClose = () => {
        setDialogOpen(false)
        localStorage.setItem("welcomeDialogDismissed", "true")
    }
 
    return (
        <>
            <Dialog open={dialogOpen} onClose={handleDialogClose}>
                <DialogTitle>Welcome!</DialogTitle>
                <DialogContent>
                    <Typography variant="body1">
                        The Fleet Management Proof of Concept (POC) was produced jointly by Twinit and Hitachi to showcase the flexibility and scalability of the Twinit platform and the speed at which Twinit development can occur. This POC was created based on Hitachi use cases and is the product of a single two week development sprint. As a result of the focus on delivering the defined user journeys, the POC is not a complete application and has not undergone full release testing. Features may be incomplete and issues may occur. Moving forward toward an MVP, these would be addressed.
                    </Typography>
                </DialogContent>
                <DialogActions>
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
                </DialogActions>
            </Dialog>
        </>
    )
}

export default HomepageDialog;