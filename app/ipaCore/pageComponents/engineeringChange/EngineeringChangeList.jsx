import React, { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Badge,
    Box
} from "@mui/material";


const EngineeringChangeList = ({ rows }) => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const handleChangePage = (_, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (e) => {
        setRowsPerPage(parseInt(e.target.value, 10));
        setPage(0);
    };

    return (
        <div>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: '20%' }}>EC Title</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Base Revision</TableCell>
                            <TableCell>Revision</TableCell>
                            <TableCell sx={{ width: '15%' }}>EC Type</TableCell>
                            <TableCell sx={{ width: 80 }}>EC ID</TableCell>
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
                                    <TableCell>{row.equipmentRevision}</TableCell>
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
        </div>
    );
};

export default EngineeringChangeList;
