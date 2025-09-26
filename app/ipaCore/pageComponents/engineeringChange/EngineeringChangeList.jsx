import React, { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    TablePagination,
    TextField,
    Button,
    Badge,
    Box
} from "@mui/material";
import AdvancedFilter from "./AdvancedFilter";

const EngineeringChangeList = ({ rows, onSearch }) => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [searchQuery, setSearchQuery] = useState("");
    const [openFilter, setOpenFilter] = useState(false);

    const handleChangePage = (_, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (e) => {
        setRowsPerPage(parseInt(e.target.value, 10));
        setPage(0);
    };

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        onSearch(value);
    };

    return (
        <Paper sx={{ p: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                <TextField
                    label="Search by EC Title"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    style={{ width: "60%" }}
                />
                <Button
                    variant="outlined"
                    onClick={() => setOpenFilter(true)}
                >
                    Advanced Filter
                </Button>
            </div>

            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: '20%' }}>EC Title</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Base Revision</TableCell>
                            <TableCell>Revision</TableCell>
                            <TableCell sx={{ width: '15%' }}>EC Type</TableCell>
                            <TableCell sx={{ width: 70 }}>EC ID</TableCell>
                            <TableCell>Date Proposed</TableCell>
                            <TableCell>Date Reviewed</TableCell>
                            <TableCell>Date Implemented</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((row, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>{row.title}</TableCell>
                                    <TableCell>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                gap: 2,
                                                alignItems: 'center'
                                            }}
                                        >
                                            <Badge badgeContent={`R:${row.statusSummary.REGISTERED}`} color="primary" />&nbsp;
                                            <Badge badgeContent={`A:${row.statusSummary.APPROVED}`} color="success" />&nbsp;
                                            <Badge badgeContent={`C:${row.statusSummary.CLOSED}`} color="error" />
                                        </Box>
                                    </TableCell>
                                    <TableCell>{row.baseRevision}</TableCell>
                                    <TableCell>{"-"}</TableCell>
                                    <TableCell>{row.type}</TableCell>
                                    <TableCell>{row.id}</TableCell>
                                    <TableCell>{row.dateProposed.split('T')[0]}</TableCell>
                                    <TableCell>{row.dateReviewed.split('T')[0]}</TableCell>
                                    <TableCell>{row.dateImplemented.split('T')[0]}</TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <TablePagination
                component="div"
                count={rows.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
            />

            <AdvancedFilter openFilter={openFilter} setOpenFilter={setOpenFilter} />
        </Paper>
    );
};

export default EngineeringChangeList;
