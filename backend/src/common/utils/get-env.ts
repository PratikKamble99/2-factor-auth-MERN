export const getEnv = (key: string, defaultValue: string = ""): string => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue) {
      return defaultValue;
    }
    console.log(key, value)
    throw new Error(`Enviroment variable ${key} is not set`);
  }
  return value;
};
