/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 */

import { CommonConstants, Priority, SymbolicEnumeration } from '../constants/CommonConstants';
import CheckEmptyUtil from './CheckEmptyUtil';

class CalculateUtil {
  /**
   * Determines whether it is an operator.
   *
   * @param value The symbol.
   * @return Is Operator.
   */
  isSymbol(value: string) {
    if (CheckEmptyUtil.isEmpty(value)) {
      return;
    }
    return (CommonConstants.OPERATORS.indexOf(value) !== -1);
  }

  /**
   * Get Operator Precedence.
   *
   * @param value The symbol.
   * @return Priority.
   */
  getPriority(value: string): number {
    if (CheckEmptyUtil.isEmpty(value)) {
      return Priority.LOW;
    }
    let result = 0;
    switch (value) {
      case SymbolicEnumeration.ADD:
      case SymbolicEnumeration.MIN:
        result = Priority.MEDIUM;
        break;
      case SymbolicEnumeration.MUL:
      case SymbolicEnumeration.DIV:
        result = Priority.HIGH;
        break;
      case SymbolicEnumeration.POWER:
      case SymbolicEnumeration.ROOT:
        result = Priority.HIGH + 1;
        break;
      default:
        result = Priority.LOW;
        break;
    }
    return result;
  }

  /**
   * Determine the priority of addition, subtraction, multiplication, and division.
   *
   * @param arg1 Parameter 1.
   * @param arg2 Parameter 2.
   * @return Compare Priority Results.
   */
  comparePriority(arg1: string, arg2: string): boolean {
    if (CheckEmptyUtil.isEmpty(arg1) || CheckEmptyUtil.isEmpty(arg2)) {
      return false;
    }
    return (this.getPriority(arg1) <= this.getPriority(arg2));
  }

  /**
   * Expression Processing.
   *
   * @param expressions Expressions.
   */
  parseExpression(expressions: Array<string>): string {
    if (CheckEmptyUtil.isEmpty(expressions)) {
      return 'NaN';
    }
    let len = expressions.length;
    let outputStack: string[] = [];
    let outputQueue: string[] = [];
    expressions.forEach((item: string, index: number) => {
      // Handle % in the expression
      if (item.indexOf(CommonConstants.PERCENT_SIGN) !== -1) {
        expressions[index] = (this.mulOrDiv(item.slice(0, item.length - 1),
          CommonConstants.ONE_HUNDRED, CommonConstants.DIV)).toString();
      }
      // Whether the last digit is an operator.
      if ((index === len - 1) && this.isSymbol(item)) {
        expressions.pop();
      }
    });
    while (expressions.length > 0) {
      let current: string | undefined = expressions.shift();
      if (current !== undefined) {
        if (current === '(') {
          outputStack.push(current);
        } else if (current === ')') {
          let matched = false;
          while (outputStack.length > 0) {
            let bracketValue = outputStack.pop();
            if (bracketValue === '(') {
              matched = true;
              break;
            }
            if (bracketValue !== undefined) {
              outputQueue.push(bracketValue);
            }
          }
          if (!matched) {
            return 'NaN';
          }
        } else if (this.isSymbol(current)) {
          // Processing addition, subtraction, multiplication and division.
          while (outputStack.length > 0 && outputStack[outputStack.length - 1] !== '(' &&
            this.shouldPopOperator(current, outputStack[outputStack.length - 1])) {
            let popValue: string | undefined = outputStack.pop();
            if (popValue !== undefined) {
              outputQueue.push(popValue);
            }
          }
          outputStack.push(current);
        } else {
          // Processing the numbers.
          outputQueue.push(current);
        }
      }
    }
    while (outputStack.length > 0) {
      let popValue: string | undefined = outputStack.pop();
      if (popValue !== undefined) {
        if (popValue === '(' || popValue === ')') {
          return 'NaN';
        }
        outputQueue.push(popValue);
      }
    }
    return this.dealQueue(outputQueue);
  }

  shouldPopOperator(current: string, stackTop: string): boolean {
    let currentPriority = this.getPriority(current);
    let stackPriority = this.getPriority(stackTop);
    let rightAssociative = current === CommonConstants.POWER || current === CommonConstants.ROOT;
    return currentPriority < stackPriority || (!rightAssociative && currentPriority === stackPriority);
  }

  /**
   * Processing expressions in queues.
   *
   * @param queue Expression Queue.
   * @return The end result.
   */
  dealQueue(queue: Array<string>): string {
    if (CheckEmptyUtil.isEmpty(queue)) {
      return 'NaN';
    }
    let outputStack: string[] = [];
    while (queue.length > 0) {
      let current: string | undefined = queue.shift();
      if (current !== undefined) {
        if (!this.isSymbol(current)) {
          outputStack.push(current);
        } else {
          let second: string | undefined = outputStack.pop();
          let first: string | undefined = outputStack.pop();
          if (first !== undefined && second !== undefined) {
            let calResultValue: string = this.calResult(first, second, current);
            outputStack.push(calResultValue);
          }
        }
      }
    }
    if (outputStack.length !== 1) {
      return 'NaN';
    } else {
      let end: string = outputStack[0]?.endsWith(CommonConstants.DOTS) ?
        outputStack[0].substring(0, outputStack[0].length - 1) : outputStack[0];
      return end;
    }
  }

  /**
   * Calculation result.
   *
   * @param arg1 Number 1.
   * @param arg2 Number 2.
   * @param symbol Operators.
   * @return Calculation result.
   */
  calResult(arg1: string, arg2: string, symbol: string): string {
    if (CheckEmptyUtil.isEmpty(arg1) || CheckEmptyUtil.isEmpty(arg2) || CheckEmptyUtil.isEmpty(symbol)) {
      return 'NaN';
    }
    let result = 0;
    switch (symbol) {
      case SymbolicEnumeration.ADD:
        result = this.add(arg1, arg2, CommonConstants.ADD);
        break;
      case SymbolicEnumeration.MIN:
        result = this.add(arg1, arg2, CommonConstants.MIN);
        break;
      case SymbolicEnumeration.MUL:
        result = this.mulOrDiv(arg1, arg2, CommonConstants.MUL);
        break;
      case SymbolicEnumeration.DIV:
        result = this.mulOrDiv(arg1, arg2, CommonConstants.DIV);
        break;
      case SymbolicEnumeration.POWER:
        result = Math.pow(Number(arg1), Number(arg2));
        break;
      case SymbolicEnumeration.ROOT:
        // 输入顺序：先输被开方数 x，再按 ʸ√，再输次方 y。算式 = y√x = x^(1/y)
        // dealQueue 弹栈顺序：second 先弹（= 表达式右侧 b）、first 后弹（= 表达式左侧 a）
        // 用户输入 [a=x, ʸ√, b=y] 时：calResult(arg1=x, arg2=y, op=ʸ√)
        // 需要 root(次方=y, 被开方=x) = Math.pow(x, 1/y) → 所以传 root(arg2, arg1)
        result = this.root(Number(arg2), Number(arg1));
        break;
      default:
        break;
    }
    return this.numberToScientificNotation(result);
  }

  root(radicand: number, degree: number): number {
    if (degree === 0) {
      return Number.NaN;
    }
    if (radicand < 0 && degree === Math.floor(degree) && Math.abs(degree % 2) === 1) {
      return -Math.pow(-radicand, 1 / degree);
    }
    return Math.pow(radicand, 1 / degree);
  }

  /**
   * Addition and subtraction operation.
   *
   * @param arg1 Number 1.
   * @param arg2 Number 2.
   * @param symbol Operators.
   * @return Addition and subtraction results.
   */
  add(arg1: string, arg2: string, symbol: string): number {
    let addFlag = (symbol === CommonConstants.ADD);
    if (this.containScientificNotation(arg1) || this.containScientificNotation(arg2)) {
      if (addFlag) {
        return Number(arg1) + Number(arg2);
      }
      return Number(arg1) - Number(arg2);
    }
    arg1 = (arg1 === CommonConstants.ZERO_DOTS) ? '0' : arg1;
    arg2 = (arg2 === CommonConstants.ZERO_DOTS) ? '0' : arg2;
    let leftArr = arg1.split(CommonConstants.DOTS);
    let rightArr = arg2.split(CommonConstants.DOTS);
    let leftLen = leftArr.length > 1 ? leftArr[1] : '';
    let rightLen = rightArr.length > 1 ? rightArr[1] : '';
    let maxLen = Math.max(leftLen.length, rightLen.length);
    let multiples = Math.pow(CommonConstants.TEN, maxLen);
    if (addFlag) {
      return Number(((Number(arg1) * multiples + Number(arg2) * multiples) / multiples).toFixed(maxLen));
    }
    return Number(((Number(arg1) * multiples - Number(arg2) * multiples) / multiples).toFixed(maxLen));
  }

  /**
   * multiplication and division operation.
   *
   * @param arg1 Number 1.
   * @param arg2 Number 2.
   * @param symbol Operators.
   * @return Multiply and divide result.
   */
  mulOrDiv(arg1: string, arg2: string, symbol: string): number {
    let mulFlag = (symbol === CommonConstants.MUL);
    if (this.containScientificNotation(arg1) || this.containScientificNotation(arg2)) {
      if (mulFlag) {
        return Number(arg1) * Number(arg2);
      }
      return Number(arg1) / Number(arg2);
    }
    let leftLen = arg1.split(CommonConstants.DOTS)[1] ? arg1.split(CommonConstants.DOTS)[1].length : 0;
    let rightLen = arg2.split(CommonConstants.DOTS)[1] ? arg2.split(CommonConstants.DOTS)[1].length : 0;
    if (mulFlag) {
      return Number(arg1.replace(CommonConstants.DOTS, '')) *
      Number(arg2.replace(CommonConstants.DOTS, '')) / Math.pow(CommonConstants.TEN, leftLen + rightLen);
    }
    return Number(arg1.replace(CommonConstants.DOTS, '')) /
      (Number(arg2.replace(CommonConstants.DOTS, '')) / Math.pow(CommonConstants.TEN, rightLen - leftLen));
  }

  /**
   * Whether the operand contains scientific notation
   *
   * @param arg Number.
   * @return Whether scientific notation is included
   */
  containScientificNotation(arg: string) {
    return (arg.indexOf(CommonConstants.E) !== -1);
  }

  /**
   * Results converted to scientific notation.
   *
   * @param result Digital Results.
   */
  numberToScientificNotation(result: number) {
    if (result !== result || result === Number.NEGATIVE_INFINITY || result === Number.POSITIVE_INFINITY) {
      return 'NaN';
    }
    if (Math.abs(result) < 0.000000000001) {
      return '0';
    }
    return Number(result.toPrecision(12)).toString();
  }
}

export default new CalculateUtil();
