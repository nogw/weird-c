export interface GenericException {
  name: "GenericException";
  message: string;
}

export const Error = {
  raise: <A extends string>(msg: A): never => {
    throw {
      name: "GenericException",
      message: msg.toString(),
    } as GenericException;
  },
};
