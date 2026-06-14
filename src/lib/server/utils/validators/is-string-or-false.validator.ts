import { type ValidationOptions, isBoolean, isString, registerDecorator } from 'class-validator';

export const IsFalseOrString = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      ...(validationOptions ? { options: validationOptions } : {}),
      constraints: [],
      validator: {
        validate(value: string) {
          return (isBoolean(value) && !value) || isString(value);
        },
        defaultMessage() {
          return `$value must be a valid IP address or FQDN`;
        },
      },
    });
  };
};
