import React from "react";
import { Card, CardContent, Typography, Button } from "@mui/material";

function App() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#f0f0f0" }}>
      <Card sx={{ maxWidth: 345, boxShadow: 3 }}>
        <CardContent>
          <Typography variant="h5">Material UI Card</Typography>
          <Typography variant="body2" color="text.secondary">
            This is an example of a Material UI-styled card.
          </Typography>
          <Button variant="contained" color="primary" sx={{ mt: 2 }}>
            Click Me
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
