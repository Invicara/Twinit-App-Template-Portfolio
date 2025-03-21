# Web Client Changes

Most of the updates in 2.0.0 are to the web client. These include:

* SimpleViewerView updates to allow for searching the model and viewing element data in a table
* New ModelContext that handles fetching and service model data to the rest of the SimpleViewerView pageComponent
* New capability to delete the latest imported model version in the SimpleModelImportView

## SimpleViewerView Updates

Review the [SimpleViewerView pageComponent](../../../../app/ipaCore/pageComponents/simpleViewer/SimpleViewerView.jsx) to see the changes to the page.

The right side element info panel has been moved into an ipa-core [StackableDrawer component](../../../../app/ipaCore/pageComponents/simpleViewer/SimpleViewerView.jsx#L58), and the [element details display](../../../../app/ipaCore/pageComponents/simpleViewer/ElementDetails/ElementDetails.jsx) has been moved into its own component.

Additionally a new [Search Stackable Drawer](../../../../app/ipaCore/pageComponents/simpleViewer/SimpleViewerView.jsx#L50) has been added that contains the [model select control](../../../../app/ipaCore/pageComponents/simpleViewer/ModelSelect/ModelSelect.jsx) and a [Search Pane component](../../../../app/ipaCore/pageComponents/simpleViewer/search/SearchPane.jsx) used to search the model elements.

Finally a [resizable bottom panel](../../../../app/ipaCore/pageComponents/simpleViewer/SimpleViewerView.jsx#L79) was added for displaying the [new element table](../../../../app/ipaCore/pageComponents/simpleViewer/panels/TablePanel.jsx).

Three new packages were added to the web client to support the new features:

* antd

[https://github.com/ant-design/ant-design](https://github.com/ant-design/ant-design)

The TreeSelect component is used in multiple places to provide a dropdown containing a selectable tree structure.

The InputNumber component is used to provide numerical input fields for property filters.

* react-resizable-panels

[https://github.com/bvaughn/react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)

The PanelGroup, Panel, and ResizeHandle components are used to provide the resizable bottom panel containing the element search table.

* @table-library/react-table-library

[https://github.com/table-library/react-table-library](https://github.com/table-library/react-table-library)

The CompactTable component and other utilities are used to display the element table in the resizable bottom panel.

## New Model Context

The web client now uses a [ModelContext](../../../../app/ipaCore/pageComponents/simpleViewer/ModelContext.js) for fetching and providing model data to the components, and avoids prop drilling.

## Delete Latest Imported Model

The [SimpleModelImportView](../../../../app/ipaCore/pageComponents/modelImport/SimpleModelImportView.jsx) has been updated to allow [deleting the latest imported model version](../../../../app/ipaCore/pageComponents/modelImport/SimpleModelImportView.jsx#L409) from Twinit.

---
[Developer Update Guide](../README.md) < Back
