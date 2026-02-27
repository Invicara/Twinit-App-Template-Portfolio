import React, {useMemo} from 'react';
import { withJsonFormsLayoutProps, JsonFormsDispatch } from '@jsonforms/react';
import { rankWith, uiTypeIs, isControl, composePaths, toDataPath } from '@jsonforms/core';
import {Box} from "@mui/material";
import {RowWithActions} from "../../InfoComponent/controls/RowWithActions.jsx";

function ActionableVerticalControls({
                                        //json from props
                                        uischema,
                                        schema,
                                        path,
                                        enabled,
                                        visible,
                                        renderers,
                                        cells,
                                        //custom props
                                        getIsEditable,
                                        getIsModifiable,
                                        getIsDeletable,
                                        onOpenModify,
                                        onOpenDelete,
                                        disabledForm}) {
    return (
        <Box>
            {uischema.elements?.map((el, i) => {
                const Control = JsonFormsDispatch
                const controlProps = {
                    uischema: el, schema, path, enabled, renderers, cells, rootSchema: schema
                }
                return isControl(el) ? (
                    <RowWithActions
                        key={i}
                        schema={schema}
                        path={path}
                        enabled={enabled}
                        Control={Control}
                        controlProps={controlProps}
                        controlUiSchema={el}
                        getIsEditable={getIsEditable}
                        getIsModifiable={getIsModifiable}
                        getIsDeletable={getIsDeletable}
                        onOpenModify={onOpenModify}
                        onOpenDelete={onOpenDelete}
                        disabledForm={disabledForm}
                    />
                ) : (
                    <Control {...controlProps}/>
                )}
            )}
        </Box>
    );
}

export function makeLayouts({
                                getIsEditable,
                                getIsModifiable,
                                getIsDeletable,
                                onOpenModify,
                                onOpenDelete,
                                disabledForm = false
}) {

    const withProps = (Layout) => (props) => {
        return  <Layout
            getIsEditable={getIsEditable}
            getIsModifiable={getIsModifiable}
            getIsDeletable={getIsDeletable}
            onOpenModify={onOpenModify}
            onOpenDelete={onOpenDelete}
            disabledForm={disabledForm}
            {...props}
        />
    };

    const VerticalLayout = withProps(withJsonFormsLayoutProps(ActionableVerticalControls));
    const GroupLayout = withProps(withJsonFormsLayoutProps(ActionableVerticalControls));
    const verticalLayoutTester = rankWith(4, uiTypeIs('VerticalLayout'));
    const groupLayoutTester = rankWith(4, uiTypeIs('Group'));

    return { VerticalLayout, verticalLayoutTester, GroupLayout, groupLayoutTester };
}
