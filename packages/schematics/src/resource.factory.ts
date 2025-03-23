import { strings } from '@angular-devkit/core';
import {
  Rule,
  SchematicContext,
  Tree,
  apply,
  url,
  template,
  mergeWith,
  SchematicsException,
  forEach,
} from '@angular-devkit/schematics';
import { Location, NameParser } from '@nestjs/schematics/dist/utils/name.parser';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Options pour la création d'une ressource
 */
interface ResourceOptions {
  name: string;
  path?: string;
  sourceRoot?: string;
}

/**
 * Fonction principale du schematic
 */
export function main(options: ResourceOptions): Rule {
  return (tree: Tree, context: SchematicContext) => {
    try {
      const nameParser = new NameParser();
      options.path = options.path ?? '';
      const location: Location = nameParser.parse(options);
      
      console.log(`Generating module for ${location.name}`);
      
      // Chemins des répertoires source et cible
      const workDir = process.cwd();
      const moduleName = strings.dasherize(location.name);
      const targetRoot = path.join(workDir, '../../apps/api/src/modules');
      const targetModuleDir = path.join(targetRoot, moduleName);
      
      // Vérifier que le répertoire cible existe ou le créer
      if (!fs.existsSync(targetRoot)) {
        fs.mkdirSync(targetRoot, { recursive: true });
      }
      
      console.log(`Target module dir: ${targetModuleDir}`);
      
      // Utiliser la fonction template des schematics
      const source = apply(url('./files'), [
        template({
          ...strings,
          name: location.name,
          className: strings.classify(location.name),
          lowercased: (name: string) => name.toLowerCase(),
          path: location.path,
        }),
        // Intercepter les fichiers générés et les écrire dans le bon répertoire
        forEach((fileEntry) => {
          // Le chemin du fichier généré contient __name__
          const originalPath = fileEntry.path;
          // Remplacer __name__ par le nom du module dans le chemin
          const relativePath = originalPath.replace(/__name__/g, moduleName);
          
          // Construire le chemin complet vers la destination
          const targetPath = path.join(targetRoot, relativePath);
          const targetDir = path.dirname(targetPath);
          
          // Créer le répertoire cible s'il n'existe pas
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          
          // Écrire le fichier
          fs.writeFileSync(targetPath, fileEntry.content);
          
          // Log avec chemin relatif
          const relativeTargetPath = path.relative(workDir, targetPath);
          context.logger.info(`CREATE ${relativeTargetPath} (${fileEntry.content.length} bytes)`);
          
          // Retourner null pour ne pas ajouter le fichier à l'arbre
          return null;
        }),
      ]);
      
      // Appliquer les templates mais sans ajouter les fichiers à l'arbre
      return mergeWith(source);
    } catch (error) {
      console.error('Error in schematic:', error);
      throw new SchematicsException(`Error in resource schematic: ${error.message}`);
    }
  };
} 