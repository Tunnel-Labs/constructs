import { Construct } from "constructs";

export class BaseConstructWithContext<C> extends Construct {
  /** Double-underscore avoids conflicting with AWS CDK variable names */
  __context: C;

  protected constructor(
    scope: BaseConstructWithContext<C>,
    id: string,
    _props?: any
  ) {
    super(scope, id);
    this.__context = scope.__context;
  }
}

type NonConstructorKeys<T> = {
  [P in keyof T]: T[P] extends new () => any ? never : P;
}[keyof T];
type NonConstructor<T> = Pick<T, NonConstructorKeys<T>>;
type Tail<T extends any[]> = ((...t: T) => void) extends (
  h: any,
  ...r: infer R
) => void
  ? R
  : never;

export function createWithContextWrapper<C>(options?: {
  onCreate?(construct: { __context: C }): void;
  beforeCreate?(
    wrapperClass: { create(): Promise<unknown> },
    ...args: any[]
  ): void;
}) {
  return function WithContext<T extends new (...args: any[]) => any>(
    Class: T
  ): NonConstructor<T> & {
    new (
      contextArg: ConstructorParameters<T>[0] & { __context: C },
      ...args: Tail<ConstructorParameters<T>>
    ): InstanceType<T> & { __context: C };
    __context: C;
    create(
      contextArg: ConstructorParameters<T>[0] & { __context: C },
      ...args: any[]
    ): Promise<InstanceType<T> & { __context: C }>;
    // `super._create()`
    _create<W extends new (...args: any) => any>(
      wrapperClass: W,
      contextArg: ConstructorParameters<T>[0] & { __context: C },
      ...args: any[]
    ): Promise<InstanceType<W> & { __context: C }>;
  } {
    return class WrapperClass extends Class {
      /** Double-underscore avoids conflicting with AWS CDK variable names */
      __context: C;

      protected constructor(/* scope:WithContextClass, */ ...args: any[]) {
        super(...args);
        const context = args[0].__context;
        if (context === undefined) {
          console.error("First argument missing __context property:", args[0]);
          throw new Error("Missing __context property in first paramater");
        }

        this.__context = context;
      }

      static async _create<W extends new (...args: any) => any>(
        Wrapper: W,
        ...args: any[]
      ): Promise<InstanceType<W> & { __context: C }> {
        await (options?.beforeCreate as any)?.(Wrapper, ...args);
        const wrapper = new Wrapper(...args);
        await (options?.onCreate as any)?.(wrapper);
        return wrapper;
      }

      static async create(
        ...args: any[]
      ): Promise<InstanceType<T> & { __context: C }> {
        return new WrapperClass(...args);
      }
    } as any;
  };
}
