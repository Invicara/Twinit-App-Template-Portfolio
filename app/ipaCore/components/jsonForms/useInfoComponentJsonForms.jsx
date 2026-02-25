import React, {useCallback, useMemo, useRef} from "react";
import { materialRenderers, materialCells } from '@jsonforms/material-renderers';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { EnumSelectRenderer, enumTester } from './renderers/EnumSelectRenderer';
import { EnumNumberSelectRenderer, enumNumberTester } from './renderers/EnumNumberSelectRenderer';

const buildUiFromSchema = (schema) => {
    if (!schema?.properties) return { type: 'VerticalLayout', elements: [] };
    const entries = Object.entries(schema.properties).sort(([ak, av], [bk, bv]) => {
        const ao = av.propertyOrder ?? 999, bo = bv.propertyOrder ?? 999;
        return ao !== bo ? ao - bo : ak.localeCompare(bk);
    });
    return {
        type: 'VerticalLayout',
        elements: entries.map(([key, prop]) => ({
            type: 'Control',
            scope: `#/properties/${key}`,
            label: prop.title || key,
            options: (prop.format == "date-time" ? { "dateTimeSaveFormat": "YYYY-MM-DDTHH:mm:ssZ" } : {})
        }))
    };
};

export function useInfoComponentJsonForms({schema, layouts, allowReadOnlyOverride}) {

    // Ajv (validation)
    const ajv = useMemo(() => {
        const a = new Ajv({ allErrors: true, strict: false });
        addFormats(a);
        return a;
    }, []);

    const {VerticalLayout, GroupLayout, verticalLayoutTester, groupLayoutTester} = layouts
    // Compose renderers: our wrappers + enum + defaults
    const renderers = useMemo(() => ([
        { tester: verticalLayoutTester, renderer: VerticalLayout },
        { tester: groupLayoutTester,    renderer: GroupLayout },
        { tester: enumTester,           renderer: EnumSelectRenderer },
        { tester: enumNumberTester,     renderer: EnumNumberSelectRenderer },
        ...materialRenderers
    ]), [verticalLayoutTester, VerticalLayout, groupLayoutTester, GroupLayout]);

    // Build UI schema from your type definition (keeps propertyOrder)
    const uiSchema = useMemo(() => buildUiFromSchema(schema), [schema]);

    const processedType = useMemo(() => {
        const type = _.cloneDeep(schema);

        if(allowReadOnlyOverride) {
            Object.entries(type.properties).forEach(([k, v]) => {
                if(v.readOnly){
                    v.readOnly = false; 
                }
            });
        }

        return type
    }, [schema, allowReadOnlyOverride])

    // External options resolver (optional): supply options per path
    const optionsResolver = useCallback(async ({ path /*, data*/ }) => {

        if (path.endsWith("/siteType")) {
            // could fetch here; returning sync for demo
            return [{ const: "900MW", title: "900 MW" }, { const: "1300MW", title: "1300 MW" }, { const: "1450MW", title: "1450 MW" }];
        }
        return undefined; // fall back to schema enum/oneOf
    }, []);


    return {processedType, renderers, optionsResolver, uiSchema, ajv, materialCells, materialRenderers};

}
