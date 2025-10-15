// TreeContext.js
import React, { createContext, useContext, useState, useCallback } from "react";
import { treeLevels } from "../../services/engineeringChanges";

const TreeContext = createContext();

export const TreeProvider = ({ children }) => {
  const [levelData, setLevelData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTreeData = useCallback(async (param1, param2) => {
    setLoading(true);
    setError(null);

    try {
      const data = await treeLevels(param1, param2);
      setLevelData(data);
      return data;
    } catch (err) {
        setError(err);
        throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <TreeContext.Provider value={{ levelData, loading, error, fetchTreeData }}>
      {children}
    </TreeContext.Provider>
  );
};

export const useTreeData = () => useContext(TreeContext);
