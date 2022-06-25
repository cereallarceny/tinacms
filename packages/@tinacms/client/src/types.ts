/**
Copyright 2021 Forestry.io Holdings, Inc.
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { TinaCollection } from '@tinacms/graphql'
import { TinaFieldInner } from '@tinacms/schema-tools'

type TinaField = TinaFieldInner<false>

const buildBoolean = (field: Extract<TinaField, { type: 'boolean' }>) => {
  return buildString(field, 'boolean')
}

const buildImage = (field: Extract<TinaField, { type: 'image' }>) => {
  return buildString(field)
}
const buildDatetime = (field: Extract<TinaField, { type: 'datetime' }>) => {
  return buildString(field)
}
const buildNumber = (field: Extract<TinaField, { type: 'number' }>) => {
  return buildString(field, 'number')
}
const buildString = (
  field:
    | Extract<TinaField, { type: 'string' }>
    | Extract<TinaField, { type: 'boolean' }>
    | Extract<TinaField, { type: 'image' }>
    | Extract<TinaField, { type: 'datetime' }>
    | Extract<TinaField, { type: 'rich-text' }>
    | Extract<TinaField, { type: 'number' }>,
  type?: string
) => {
  let s = type || `string`
  if (field.type !== 'rich-text') {
    if (field.options) {
      const values: string[] = []
      field.options.map((option) => {
        if (typeof option === 'string') {
          values.push(`"${option}"`)
        } else {
          values.push(`"${option.value}"`)
        }
      })
      s = `${values.join(' | ')}`
    }
  }
  let o = ''
  if (!field.required) {
    o = '?'
  }
  if (field.list) {
    return `${formatDescription(field)}${field.name}${o}: ${s}[]`
  }
  return `${formatDescription(field)}${field.name}${o}: ${s}`
}
const formatDescription = (field: TinaField) => {
  return field.description
    ? `/**
* ${field.description.split('\n').join('\n * ')}
*/\n`
    : ''
}
const buildField = (field: TinaField) => {
  switch (field.type) {
    case 'boolean':
      return buildBoolean(field)
    case 'datetime':
      return buildDatetime(field)
    case 'image':
      return buildImage(field)
    case 'number':
      return buildNumber(field)
    case 'string':
      return buildString(field)
    case 'rich-text':
      return buildString(field, 'object')
    case 'reference':
      return `${formatDescription(field)}${field.name}${
        field.required ? '' : '?'
      }: R["${field.name}"] extends true
      ? ${field.collections[0]}Type
      : R["${field.name}"] extends { ${field.collections[0]}: ${
        field.collections[0]
      }Options }
      ? ${field.collections[0]}Return<
        R["${field.name}"]["${field.collections[0]}"]["fields"],
        R["${field.name}"]["${field.collections[0]}"]["include"]
      >
      : { id: string }`
    case 'object':
      if (field.templates) {
        const u = `${field.templates
          .map((template) => {
            if (typeof template === 'string') {
              throw new Error('Global templates not supported')
            }
            return `${buildFields({
              field: field,
              fields: template.fields,
              extra: [`_template: "${template.name}"`],
            })}`
          })
          .join(' | ')}`

        let res = u
        if (field.list) {
          res = `(${res})[]`
        }
        let o = ''
        if (!field.required) {
          o = '?'
        }
        return `${field.name}${o}: ${res}`
      } else {
        if (typeof field.fields === 'string') {
          throw new Error('Global templates not supported')
        }
        let o = ''
        if (!field.required) {
          o = '?'
        }

        return `${field.name}${o}: ${buildFields({
          field,
          fields: field.fields,
        })}`
      }
    default:
      break
  }
}

const buildFields = ({
  field,
  fields,
  extra,
  includeSys,
}: {
  field: { name: string; list?: boolean; required?: boolean }
  fields: TinaField[]
  extra?: string[]
  includeSys?: boolean
}) => {
  const fieldStrings = []
  fields.forEach((field) => {
    fieldStrings.push(buildField(field))
  })
  if (extra) {
    extra.forEach((extraItem) => {
      fieldStrings.push(extraItem)
    })
  }
  if (includeSys) {
    fieldStrings.push(
      `/**
* Metadata about the file
*/
_template: string
_collection: string
_sys: {
  filename: string,
  basename: string,
  breadcrumbs: string[],
  path: string,
  relativePath: string,
  extension: string,
  template: string,
  collection: {
    name: string,
    format: string
  },
  __typename: string
}`
    )
  }
  let string = `{${fieldStrings.join(',\n')}}`
  if (field.list) {
    string = `${string}[]`
  }
  return string
}

export const buildTypes2 = (collection: TinaCollection) => {
  if (collection.fields) {
    if (typeof collection.fields === 'string') {
      throw new Error('Global templates not supported')
    }
    const stringFields = buildFields({
      field: collection,
      fields: collection.fields,
      includeSys: true,
    })
    // FIXME: we're faking the old vs new, when this is for real the old type
    // will come from the older schema version in Git.
    const string = `type ${collection.name}Type<R extends ${collection.name}References = {}> = ${stringFields}`
    return string
  }
}
