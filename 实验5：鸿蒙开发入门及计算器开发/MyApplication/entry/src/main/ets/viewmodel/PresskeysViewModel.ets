/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 */

import { PressKeyItem } from './PressKeysItem';

export class PressKeysViewModel {
  /**
   * Key array data.
   */
  getPressKeys(): Array<Array<PressKeyItem>> {
    return [
      [
        new PressKeyItem(2, '28vp', '37vp', 'C', $r('app.media.clean')),
        new PressKeyItem(1, '26vp', '35vp', '7'),
        new PressKeyItem(1, '26vp', '35vp', '4'),
        new PressKeyItem(1, '26vp', '35vp', '1'),
        new PressKeyItem(1, '26vp', '35vp', '%')
      ],
      [
        new PressKeyItem(2, '42vp', '56vp', '÷', $r('app.media.ic_div')),
        new PressKeyItem(1, '26vp', '35vp', '8'),
        new PressKeyItem(1, '26vp', '35vp', '5'),
        new PressKeyItem(1, '26vp', '35vp', '2'),
        new PressKeyItem(1, '26vp', '35vp', '0')
      ],
      [
        new PressKeyItem(2, '42vp', '56vp', '×', $r('app.media.ic_mul')),
        new PressKeyItem(1, '26vp', '35vp', '9'),
        new PressKeyItem(1, '26vp', '35vp', '6'),
        new PressKeyItem(1, '26vp', '35vp', '3'),
        new PressKeyItem(1, '26vp', '35vp', '.')
      ],
      [
        new PressKeyItem(0, '30.48vp', '20vp', 'del', $r('app.media.ic_delete')),
        new PressKeyItem(2, '42vp', '56vp', '-', $r('app.media.ic_min')),
        new PressKeyItem(2, '42vp', '56vp', '+', $r('app.media.ic_add')),
        new PressKeyItem(3, '28vp', '54vp', '=', $r('app.media.ic_equ'))
      ]
    ];
  }
}

let keysModel = new PressKeysViewModel();

export default keysModel as PressKeysViewModel;
