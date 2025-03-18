import { join, Path, strings } from '@angular-devkit/core';
import {
  apply,
  branchAndMerge,
  chain,
  mergeWith,
  move,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import { Location, NameParser } from '@nestjs/schematics/dist/utils/name.parser';
import { mergeSourceRoot } from '@nestjs/schematics/dist/utils/source-root.helpers';

interface ResourceOptions {
  name: string;
  path?: string;
  sourceRoot?: string;
}

export function main(options: ResourceOptions): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const nameParser = new NameParser();
    options.path = options.path ?? '';
    const location: Location = nameParser.parse(options);
    const modulePath = join(
      strings.dasherize(options.path) as Path,
      strings.dasherize(location.path) as Path,
      strings.dasherize(location.name),
    );

    return chain([
      mergeSourceRoot(options),
      branchAndMerge(
        chain([
          generateModuleFiles(options, location, modulePath),
        ]),
      ),
    ])(tree, context);
  };
}

function generateModuleFiles(
  options: ResourceOptions,
  location: Location,
  modulePath: Path,
): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const templateSource = apply(url('./files'), [
      template({
        ...strings,
        ...options,
        lowercased: (name: string) => name.toLowerCase(),
        name: location.name,
        path: location.path,
        className: strings.classify(location.name),
      }),
      move(join('src' as Path, 'modules' as Path, modulePath)),
    ]);

    return mergeWith(templateSource)(tree, _context);
  };
} 