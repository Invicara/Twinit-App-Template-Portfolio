import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Box, Grid, Card, CardMedia, CardContent, Tooltip } from '@mui/material';
import CustomButton from '../../../../components/atoms/CustomButton';
import { useDispatch, useSelector } from 'react-redux';
import { getCachedFile } from '../../../../../services/utils';
import { Cancel, Dashboard } from '@material-ui/icons';
import { setDraftType, setIsSelectingPosition } from '../../../../redux/siteSetup';
import { getSelectedStructure, getStructures, setSelectedGraphicReference, setSelectedStructure } from '../../../../redux/pageComponentState';


const BuildingThumbnails = ({
    mapGraphicReferences,
    handleCancelNewBuildingMode,
    lowerNamedPath,
    send,
    upperLevelEntity,
    onStructureChangeCb,
    currentEntity
}) => {
    const dispatch = useDispatch();

    const [thumbnailUrls, setThumbnailUrls] = useState({});
    const selectedStructure = useSelector(getSelectedStructure);
    const structures = useSelector(getStructures);

    // Helper function to check compatibility and get detailed reasons
    const getStructureCompatibility = (structure) => {
        if (!upperLevelEntity || !structure.requiredBackgroundProperties) {
            return { compatible: true, reasons: [] }; // If no requirements or no entity, allow all
        }

        const requirements = structure.requiredBackgroundProperties;
        const reasons = [];
        let compatible = true;
        
        // Check each required property
        for (const [propertyKey, requirement] of Object.entries(requirements)) {
            const entityValue = upperLevelEntity[propertyKey];
            const requiredValues = requirement.values || [];
            
            // If entity doesn't have the property or its value is not in required values, it's incompatible
            if (!entityValue || !requiredValues.includes(entityValue)) {
                compatible = false;
                const reason = entityValue 
                    ? `${propertyKey}: "${entityValue}" not in [${requiredValues.join(', ')}]`
                    : `${propertyKey}: not set (required: [${requiredValues.join(', ')}])`;
                reasons.push(reason);
            }
        }
        
        return { compatible, reasons };
    };

    // Get available structures with their corresponding graphic references
    const availableStructures = useMemo(() => {
        if (!structures || !mapGraphicReferences) return [];
        
        return Object.values(structures)
            .map(structure => {
                // Find matching graphic reference by _id === mapGraphicRefId
                const graphicRef = mapGraphicReferences.find(ref => ref._id === structure.mapGraphicRefId);
                if (!graphicRef) return null;
                
                const { compatible, reasons } = getStructureCompatibility(structure);
                
                return {
                    structure,
                    graphicRef,
                    compatible,
                    incompatibilityReasons: reasons
                };
            })
            .filter(item => item !== null); // Remove structures without matching graphic references
    }, [structures, mapGraphicReferences]);

    useEffect(() => {
        return () => {
            dispatch(setDraftType());
            dispatch(setIsSelectingPosition(false));
            dispatch(setSelectedGraphicReference());
        }
    }, [])

    // Handle thumbnail click for building selection
    const handleThumbnailClick = (structure, graphicReference, compatible) => {
        // Don't allow selection of incompatible structures
        if (!compatible) return;

        if(currentEntity && onStructureChangeCb){
            console.log("APPLYING_currentEntity")
            onStructureChangeCb(structure);
            return;
        }
        
        if(selectedStructure !== structure){
            dispatch(setDraftType(lowerNamedPath.state));
            dispatch(setIsSelectingPosition(true));
            dispatch(setSelectedStructure(structure));
            dispatch(setSelectedGraphicReference(graphicReference));
            send({ type: "START_DRAFT" });
        } else {
            dispatch(setDraftType());
            dispatch(setIsSelectingPosition(false));
            dispatch(setSelectedStructure());            
            dispatch(setSelectedGraphicReference());
            send({ type: "END_DRAFT" });
        }
    };

    useEffect(() => {
        const loadThumbnails = async () => {
            const urls = {};
            for (const item of availableStructures) {
                const ref = item.graphicRef;
                if (ref.thumbnail) {
                    try {
                        const url = await getCachedFile(ref.thumbnail);
                        if (url) {
                            urls[ref.thumbnail] = url;
                        }
                    } catch (error) {
                        console.error(`Failed to load thumbnail for ${ref.thumbnail}:`, error);
                    }
                }
            }
            setThumbnailUrls(urls);
        };

        if (availableStructures && availableStructures.length > 0) {
            loadThumbnails();
        }
    }, [availableStructures]);

    return (
        <Box sx={{ mt: 2 }}>
            {!currentEntity && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: 16 }}>
                    Select Structure Type
                </Typography>
                <CustomButton
                    variant="outlined"
                    color="secondary"
                    onClick={handleCancelNewBuildingMode}
                    size="small"
                    startIcon={<Cancel />}
                >
                    Cancel
                </CustomButton>
            </div>}

            {availableStructures.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                    No structure types available
                </Typography>
            ) : (
                <Grid container spacing={2}>
                    {availableStructures.map((item, index) => {
                        const { structure, graphicRef, compatible, incompatibilityReasons } = item;
                        const isSelected = currentEntity?.structureName === structure.name || (!currentEntity && structure === selectedStructure);
                        
                        // Create tooltip content for incompatible structures
                        const tooltipTitle = compatible ? '' : (
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                    Requirements not met:
                                </Typography>
                                {incompatibilityReasons.map((reason, idx) => (
                                    <Typography key={idx} variant="body2" sx={{ fontSize: '0.75rem' }}>
                                        • {reason}
                                    </Typography>
                                ))}
                            </Box>
                        );
                        
                        const cardComponent = (
                            <Card
                                style={{
                                    cursor: compatible ? 'pointer' : 'not-allowed',
                                    opacity: compatible ? 1 : 0.5,
                                    backgroundColor: isSelected ? 'rgba(223, 21, 140, 0.1)' : 'transparent',
                                    border: isSelected ? '2px solid #DF158C' : '2px solid transparent',
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': compatible ? {
                                        transform: isSelected ? 'scale(1.02) translateY(-2px)' : 'translateY(-2px)',
                                        boxShadow: isSelected ? '0 6px 16px rgba(223, 21, 140, 0.4)' : '0 4px 8px rgba(0,0,0,0.15)'
                                    } : {}
                                }}
                                onClick={() => handleThumbnailClick(structure, graphicRef, compatible)}
                            >
                                {graphicRef.thumbnail && thumbnailUrls[graphicRef.thumbnail] ? (
                                    <CardMedia
                                        component="img"
                                        height="80"
                                        image={thumbnailUrls[graphicRef.thumbnail]}
                                        alt={structure.name || 'Structure thumbnail'}
                                        sx={{ 
                                            objectFit: 'cover',
                                            filter: compatible ? 'none' : 'grayscale(100%)'
                                        }}
                                    />
                                ) : (
                                    <Box
                                        sx={{
                                            height: 80,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: '#f5f5f5',
                                            filter: compatible ? 'none' : 'grayscale(100%)'
                                        }}
                                    >
                                        <Dashboard sx={{ fontSize: 32, color: compatible ? '#ccc' : '#999' }} />
                                    </Box>
                                )}
                                <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                    <Typography 
                                        variant="caption" 
                                        display="block" 
                                        sx={{ 
                                            textAlign: 'center', 
                                            fontSize: '0.75rem',
                                            color: compatible ? 'inherit' : 'text.disabled'
                                        }}
                                    >
                                        {structure.name || `Structure ${index + 1}`}
                                    </Typography>
                                    {!compatible && (
                                        <Typography 
                                            variant="caption" 
                                            display="block" 
                                            sx={{ 
                                                textAlign: 'center', 
                                                fontSize: '0.65rem',
                                                color: 'error.main',
                                                fontStyle: 'italic'
                                            }}
                                        >
                                            Requirements not met
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        );
                        
                        return (
                            <Grid item xs={6} sm={4} md={3} key={structure._id || index}>
                                {compatible ? (
                                    cardComponent
                                ) : (
                                    <Tooltip 
                                        title={tooltipTitle} 
                                        arrow 
                                        placement="top"
                                        componentsProps={{
                                            tooltip: {
                                                sx: {
                                                    maxWidth: 300,
                                                    fontSize: '0.75rem',
                                                    backgroundColor: 'rgba(200, 200, 200, 0.9)'
                                                }
                                            }
                                        }}
                                    >
                                        <span>{cardComponent}</span>
                                    </Tooltip>
                                )}
                            </Grid>
                        );
                    })}
                </Grid>
            )}
        </Box>
    );
};

export default BuildingThumbnails;
