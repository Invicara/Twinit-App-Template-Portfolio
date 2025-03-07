export const BASELINE_THEME = {
   Table: '',
   Header: '',
   Body: '',
   BaseRow: `
     font-size: 16px;
   `,
   HeaderRow: `
     color: var(--element-table-font-primary);
   `,
   Row: `
     color: var(--element-table-font-secondary);
 
     &.disabled {
       color: var(--element-table-font-disabled);
     }
 
     &:hover {
       color: var(--element-table-font-primary);
     }
 
     &:not(:last-of-type) > .td {
       border-bottom: 1px solid var(--element-table-border);
     }
   `,
   BaseCell: `
     padding: 6px 12px;
   `,
   HeaderCell: `
     font-weight: bold;
     border-bottom: 1px solid var(--element-table-border);
 
     .resizer-handle {
       background-color: var(--element-table-border);
     }
 
     svg,
     path {
       fill: currentColor;
     }
   `,
   Cell: `
     &:focus {
       outline: dotted;
       outline-width: 1px;
       outline-offset: -1px;
     }
   `,
}