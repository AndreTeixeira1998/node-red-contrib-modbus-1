/**
 Copyright 2016,2017 - Klaus Landsdorf (http://bianco-royal.de/)
 All rights reserved.
 node-red-contrib-modbus
 node-red-contrib-modbusio

 @author <a href="mailto:klaus.landsdorf@bianco-royal.de">Klaus Landsdorf</a> (Bianco Royal)
 */
'use strict'

var de = de || {biancoroyal: {modbus: {io: {core: {}}}}} // eslint-disable-line no-use-before-define
de.biancoroyal.modbus.io.core.internalDebug = de.biancoroyal.modbus.io.core.internalDebug || require('debug')('contribModbus:io:core') // eslint-disable-line no-use-before-define
de.biancoroyal.modbus.io.core.LineByLineReader = de.biancoroyal.modbus.io.core.LineByLineReader || require('line-by-line') // eslint-disable-line no-use-before-define

de.biancoroyal.modbus.io.core.nameValuesFromIOFile = function (msg, ioFileConfig, values, response) {
  let valueNames = []
  let ioCore = de.biancoroyal.modbus.io.core

  if (ioFileConfig.configData) {
    ioFileConfig.configData.forEach(function (mapping) {
      if (mapping.valueAddress.startsWith('%I')) {
        valueNames.push(ioCore.buildInputAddressMapping('MB-INPUTS', mapping, mapping.name.substring(0, 1), ioFileConfig.addressOffset))
      }

      if (mapping.valueAddress.startsWith('%Q')) {
        valueNames.push(ioCore.buildOutputAddressMapping('MB-OUTPUTS', mapping, mapping.name.substring(0, 1), ioFileConfig.addressOffset))
      }
    })
  }

  valueNames = ioCore.insertValues(valueNames, values)

  return ioCore.convertValuesByType(valueNames, values, response)
}

de.biancoroyal.modbus.io.core.getDataTypeFromFirstCharType = function (type) {
  switch (type) {
    case 'w':
      return 'Word'
    case 'd':
      return 'Double'
    case 'r':
      return 'Real'
    case 'f':
      return 'Float'
    case 'i':
      return 'Integer'
    case 'l':
      return 'Long'
    case 'b':
      return 'Boolean'
    default:
      return 'Unsigned Integer'
  }
}

de.biancoroyal.modbus.io.core.buildInputAddressMapping = function (registerName, mapping, type, offset) {
  let ioCore = de.biancoroyal.modbus.io.core
  let addressStart = 0
  let coilStart = 0
  let addressOffset = 0
  let bits = 0
  let bitAddress = ''

  let registerType = mapping.valueAddress.substring(2, 3)
  let addressType = mapping.valueAddress.substring(0, 3)

  switch (type) {
    case 'w': // word
    case 'u': // unsigned integer
      addressStart = Number(mapping.valueAddress.split(addressType)[1])
      addressOffset = 1
      bits = 16
      break
    case 'd': // double
    case 'r': // real
    case 'f': // float
    case 'i': // integer
      addressStart = Number(mapping.valueAddress.split(addressType)[1])
      addressOffset = 2
      bits = 32
      break
    case 'l': // long
      addressStart = Number(mapping.valueAddress.split(addressType)[1])
      addressOffset = 4
      bits = 64
      break
    case 'b': // bit - boolean
      if (registerType === 'X') {
        bitAddress = mapping.valueAddress.split('%IX')[1].split('.')
        addressStart = Math.floor(Number(bitAddress[0]) / 2)
        coilStart = Number(bitAddress[0]) * 8 + Number(bitAddress[1])
        addressOffset = 1
        bits = 1
      }
      break
    default:
      bits = 0
  }

  if (bits) {
    return {
      'register': registerName,
      'name': mapping.name,
      'addressStart': addressStart,
      'addressOffset': addressOffset,
      'addressOffsetIO': Number(offset) || 0,
      'addressStartIO': addressStart - (Number(offset) || 0),
      'coilStart': coilStart,
      'bitAddress': bitAddress,
      'bits': bits,
      'dataType': ioCore.getDataTypeFromFirstCharType(type),
      'type': 'input'
    }
  }

  return {'name': mapping.name, 'type': type, 'mapping': mapping, 'error': 'variable name does not match input mapping'}
}

de.biancoroyal.modbus.io.core.buildOutputAddressMapping = function (registerName, mapping, type, offset) {
  let ioCore = de.biancoroyal.modbus.io.core
  let addressStart = 0
  let coilStart = 0
  let addressOffset = 0
  let bits = 0
  let bitAddress = 'none'

  let registerType = mapping.valueAddress.substring(2, 3)
  let addressType = mapping.valueAddress.substring(0, 3)

  switch (type) {
    case 'w': // word
    case 'u': // unsigned integer
      addressStart = Number(mapping.valueAddress.split(addressType)[1])
      addressOffset = 1
      bits = 16
      break
    case 'd': // double
    case 'r': // real
    case 'f': // float
    case 'i': // integer
      addressStart = Number(mapping.valueAddress.split(addressType)[1])
      addressOffset = 2
      bits = 32
      break
    case 'l': // long
      addressStart = Number(mapping.valueAddress.split(addressType)[1])
      addressOffset = 4
      bits = 64
      break
    case 'b': // bit - boolean
      if (registerType === 'X') {
        bitAddress = mapping.valueAddress.split('%QX')[1].split('.')
        addressStart = Math.floor(Number(bitAddress[0]) / 2)
        coilStart = Number(bitAddress[0]) * 8 + Number(bitAddress[1])
        addressOffset = 1
        bits = 1
      }
      break
    default:
      bits = 0
  }

  if (bits) {
    return {
      'register': registerName,
      'name': mapping.name,
      'addressStart': addressStart,
      'addressOffset': addressOffset,
      'addressOffsetIO': Number(offset) || 0,
      'addressStartIO': addressStart - (Number(offset) || 0),
      'coilStart': coilStart,
      'bitAddress': bitAddress,
      'bits': bits,
      'dataType': ioCore.getDataTypeFromFirstCharType(type),
      'type': 'output'
    }
  }

  return {'name': mapping.name, 'type': type, 'mapping': mapping, 'error': 'variable name does not match output mapping'}
}

de.biancoroyal.modbus.io.core.insertValues = function (valueNames, register) {
  let ioCore = de.biancoroyal.modbus.io.core

  let index = 0
  for (index in valueNames) {
    let item = valueNames[index]

    if (!item || !item.hasOwnProperty('addressStart')) {
      ioCore.internalDebug('Item Not Valid To Insert Value ' + JSON.stringify(item))
      continue
    }

    let registerAddress = item.addressStart - item.addressOffsetIO

    if (registerAddress < 0 || de.biancoroyal.modbus.io.core.isRegisterSizeWrong(register, registerAddress, Number(item.bits))) {
      ioCore.internalDebug('Insert Value Register Reached At Address-Start:' + item.addressStart + ' Bits:' + Number(item.bits))
      break
    }

    switch (Number(item.bits)) {
      case 1:
        item.value = !!((register[registerAddress] & Math.pow(2, item.bitAddress[1])))
        break
      case 16:
        item.value = register[registerAddress]
        break
      case 32:
        item.value = register[registerAddress + 1] << 16 |
          register[registerAddress]
        break
      case 64:
        item.value = register[registerAddress + 3] << 48 |
          register[registerAddress + 2] << 32 |
          register[registerAddress + 1] << 16 |
          register[registerAddress]
        break
      default:
        item.value = null
        break
    }
  }

  return valueNames
}

de.biancoroyal.modbus.io.core.getValueFromBufferByDataType = function (item, bufferOffset, responseBuffer) {
  let ioCore = de.biancoroyal.modbus.io.core

  if (bufferOffset < 0 || bufferOffset > responseBuffer.length / 2) {
    ioCore.internalDebug('Wrong Buffer Access Parameter Type:' + item.dataType + 'Length:' + responseBuffer.length + ' Address-Buffer-Offset:' + bufferOffset)
    ioCore.internalDebug(JSON.stringify(item))
    return item
  }

  switch (item.dataType) {
    case 'Boolean':
      item.value = responseBuffer.readInt16BE(bufferOffset) && Math.pow(item.bitAddress, 2) // Bit state
      break
    case 'Word':
      switch (item.bits) {
        case '8':
          item.value = responseBuffer.readInt8(bufferOffset)
          break
        default:
          item.value = responseBuffer.readInt16BE(bufferOffset) // DWord
      }
      break
    case 'Integer':
    case 'Long':
      switch (item.bits) {
        case '8':
          item.value = responseBuffer.readInt8(bufferOffset)
          break
        case '32':
          item.value = responseBuffer.readInt32BE(bufferOffset)
          break
        case '64':
          item.value = responseBuffer.readIntBE(bufferOffset, 8)
          break
        default:
          item.value = responseBuffer.readInt16BE(bufferOffset)
      }
      break
    case 'Real':
    case 'Float':
      switch (item.bits) {
        case '32':
          item.value = responseBuffer.readFloatBE(bufferOffset, 4)
          break
        case '64':
          item.value = responseBuffer.readFloatBE(bufferOffset, 8)
          break
        default:
          item.value = responseBuffer.readFloatBE(bufferOffset, 2) // 16Bit
      }
      break
    case 'Double':
      switch (item.bits) {
        case '64':
          item.value = responseBuffer.readDoubleBE(bufferOffset, 8)
          break
        case '128':
          item.value = responseBuffer.readDoubleBE(bufferOffset, 16)
          break
        default:
          item.value = responseBuffer.readDoubleBE(bufferOffset, 4) // 32Bit
      }
      break
    default:
      switch (item.bits) {
        case '8':
          item.value = responseBuffer.readUInt8(bufferOffset)
          break
        case '32':
          item.value = responseBuffer.readUInt32BE(bufferOffset)
          break
        case '64':
          item.value = responseBuffer.readUIntBE(bufferOffset, 8)
          break
        default:
          item.value = responseBuffer.readUInt16BE(bufferOffset)
          item.convertedValue = false
      }
      break
  }

  return item
}

de.biancoroyal.modbus.io.core.convertValuesByType = function (valueNames, register, responseBuffer) {
  let ioCore = de.biancoroyal.modbus.io.core
  let bufferOffset = 0
  let sixteenBitBufferLength = 2

  let index = 0
  for (index in valueNames) {
    let item = valueNames[index]
    if (!item || !item.hasOwnProperty('dataType')) {
      ioCore.internalDebug('Item Not Valid To Convert ' + JSON.stringify(item))
      continue
    }

    let registerAddress = item.addressStart - item.addressOffsetIO

    if (registerAddress < 0 || de.biancoroyal.modbus.io.core.isRegisterSizeWrong(register, registerAddress, Number(item.bits))) {
      ioCore.internalDebug('Insert Value Register Reached At Address-Start:' + item.addressStart + ' Bits:' + Number(item.bits))
      break
    }

    if (responseBuffer.buffer instanceof Buffer) {
      bufferOffset = (registerAddress) * sixteenBitBufferLength
      try {
        item = ioCore.getValueFromBufferByDataType(item, bufferOffset, responseBuffer.buffer)
      } catch (err) {
        ioCore.internalDebug(err.message)
      }
    } else {
      ioCore.internalDebug('Response Buffer Is Not A Buffer ' + JSON.stringify(responseBuffer))
      break
    }
  }

  return valueNames
}

de.biancoroyal.modbus.io.core.filterValueNames = function (valueNames, fc, adr, quantity) {
  let functionType = 'input'

  if (fc.includes('Input')) {
    functionType = 'output'
  }

  return valueNames.filter((valueName) => {
    return valueName.addressStartIO >= adr && valueName.addressStartIO <= (adr + quantity - 1) && valueName.type === functionType
  })
}

de.biancoroyal.modbus.io.core.isRegisterSizeWrong = function (register, start, bits) {
  let sizeDivisor = bits || 1
  let startRegister = start
  let endRegister = start

  if (sizeDivisor > 8) {
    startRegister = start
    endRegister = start + (sizeDivisor / 8)
  }
  return (startRegister >= 0 && register.length >= startRegister && endRegister <= register.length)
}

module.exports = de.biancoroyal.modbus.io.core
