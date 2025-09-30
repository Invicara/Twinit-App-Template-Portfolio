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
    Box,
    Paper,
    Typography
} from "@mui/material";
import { styled } from '@mui/material/styles';
import { formatDateOnly } from './common/utility.js';

const StyledTableHeadRow = styled(TableRow)(({ theme }) => ({
    backgroundColor: '#eaeaea',
    '& .MuiTableCell-root': {
        color: theme.palette.common.black, // Header text color
        fontWeight: 'bold',
    },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
    '&:nth-of-type(odd)': {
        backgroundColor: theme.palette.background.paper, // Odd row color
    },
    '&:nth-of-type(even)': {
        backgroundColor: theme.palette.action.hover, // Even row color
    },
}));

const EngineeringChangeList = ({ rows }) => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const isDataEmpty = rows.length === 0;

    const handleChangePage = (_, newPage) => setPage(newPage);

    const handleChangeRowsPerPage = (e) => {
        setRowsPerPage(parseInt(e.target.value, 10));
        setPage(0);
    };

    return (
        <Paper>
            <TablePagination
                style={{ display: 'flex', justifyContent: 'flex-start' }}
                component="div"
                count={rows.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
            />
            <TableContainer
                sx={{
                    maxHeight: '570px',
                    overflowY: 'auto',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(0, 0, 0, 0.3) transparent',
                    '&::-webkit-scrollbar': {
                        width: '6px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '10px',
                    },
                }}
            >
                <Table stickyHeader aria-label="scrollable table">
                    <TableHead>
                        <StyledTableHeadRow>
                            <TableCell sx={{ width: '20%' }}>EC Title</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Base Revision</TableCell>
                            <TableCell>Revision</TableCell>
                            <TableCell sx={{ width: '15%' }}>EC Type</TableCell>
                            <TableCell sx={{ width: 80 }}>EC ID</TableCell>
                            <TableCell>Date Proposed</TableCell>
                            <TableCell>Date Reviewed</TableCell>
                            <TableCell>Date Implemented</TableCell>
                        </StyledTableHeadRow>
                    </TableHead>
                    <TableBody>
                        {isDataEmpty ? (
                            <TableRow>
                                <TableCell colSpan={9} align="center">
                                    <Typography color="textSecondary" variant="body1" sx={{ p: 2 }}>
                                        **No records found.** Try adjusting your filters or search terms.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map((row, idx) => (
                                    <StyledTableRow key={idx}>
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
                                                <Badge badgeContent={`A:${row.statusSummary.APPROVED}`} color="warning" />&nbsp;
                                                <Badge badgeContent={`C:${row.statusSummary.CLOSED}`} color="success" />
                                            </Box>
                                        </TableCell>
                                        <TableCell>{row.baseRevision}</TableCell>
                                        <TableCell>{row.equipmentRevision}</TableCell>
                                        <TableCell>{row.type}</TableCell>
                                        <TableCell>{row.id}</TableCell>
                                        <TableCell>{formatDateOnly(row.dateProposed)}</TableCell>
                                        <TableCell>{formatDateOnly(row.dateReviewed)}</TableCell>
                                        <TableCell>{formatDateOnly(row.dateImplemented)}</TableCell>
                                    </StyledTableRow>
                                ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

export default EngineeringChangeList;
