export interface CliOption {
  choices?: readonly string[];
  description?: string;
  name: string;
  type: "boolean" | "string";
}

export interface CliSpecification {
  allowPositionals?: boolean;
  command: string;
  description: string;
  options: readonly CliOption[];
}

export interface ParsedCliArguments {
  help: boolean;
  positionals: string[];
  values: Partial<Record<string, boolean | string>>;
}

function optionUsage(option: CliOption) {
  if (option.type === "boolean") {
    return `--${option.name}`;
  }
  const value = option.choices?.join("|") ?? "value";
  return `--${option.name} <${value}>`;
}

export function formatCliHelp(specification: CliSpecification) {
  return [
    specification.description,
    `Usage: ${specification.command} [options]`,
    "Options:",
    ...specification.options.map((option) => `  ${optionUsage(option)}`),
    "  --help",
  ].join("\n");
}

function validateChoice(option: CliOption, value: string) {
  if (option.choices && !option.choices.includes(value)) {
    throw new Error(
      `Invalid value for --${option.name}: ${value || "(missing)"}. Valid choices: ${option.choices.join(", ")}`
    );
  }
}

function parseNamedOption({
  args,
  argument,
  index,
  options,
  specification,
  values,
}: {
  args: readonly string[];
  argument: string;
  index: number;
  options: Map<string, CliOption>;
  specification: CliSpecification;
  values: Record<string, boolean | string>;
}) {
  const equalsIndex = argument.indexOf("=");
  const name = argument.slice(2, equalsIndex >= 0 ? equalsIndex : undefined);
  const option = options.get(name);
  if (!option) {
    throw new Error(`Unknown flag --${name}. Try ${specification.command} --help`);
  }
  if (option.type === "boolean") {
    if (equalsIndex >= 0) {
      throw new Error(`--${name} is a boolean flag and does not take a value`);
    }
    values[name] = true;
    return index;
  }

  const inlineValue = equalsIndex >= 0 ? argument.slice(equalsIndex + 1) : undefined;
  const value = inlineValue ?? args[index + 1];
  if (!value || (inlineValue === undefined && value.startsWith("--"))) {
    throw new Error(`--${name} requires a value. Try ${specification.command} --help`);
  }
  validateChoice(option, value);
  values[name] = value;
  return inlineValue === undefined ? index + 1 : index;
}

export function parseCliArguments(
  args: readonly string[],
  specification: CliSpecification
): ParsedCliArguments {
  if (args.includes("--help")) {
    return { help: true, positionals: [], values: {} };
  }

  const options = new Map(specification.options.map((option) => [option.name, option]));
  const positionals: string[] = [];
  const values: Record<string, boolean | string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") {
      positionals.push(...args.slice(index + 1));
      break;
    }
    if (!argument?.startsWith("--")) {
      if (specification.allowPositionals) {
        positionals.push(...args.slice(index));
        break;
      }
      throw new Error(`Unexpected argument ${argument}. Try ${specification.command} --help`);
    }

    index = parseNamedOption({ args, argument, index, options, specification, values });
  }

  if (positionals.length > 0 && !specification.allowPositionals) {
    throw new Error(`Unexpected arguments. Try ${specification.command} --help`);
  }

  return { help: false, positionals, values };
}
