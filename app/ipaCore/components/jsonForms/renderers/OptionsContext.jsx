import React from 'react';

// Option can be "foo" or { const: "foo", title: "Foo" }
export const OptionsContext = React.createContext({
    resolve:() => undefined //TODO: make script
});
