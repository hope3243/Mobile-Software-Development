/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 */

export class PressKeyItem {
  flag: number;
  width: string;
  height: string;
  value: string;
  source?: Resource;

  constructor(flag: number, width: string, height: string, value: string, source?: Resource) {
    this.flag = flag;
    this.width = width;
    this.height = height;
    this.value = value;
    this.source = source;
  }
}
