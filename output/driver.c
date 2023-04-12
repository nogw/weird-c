#include "driver.h"
#include <err.h>
#include <stdio.h>
#include <stdlib.h>

void destroy_val(val_t *val) { free(val); }

struct val *build_cls(val_t *(*code)(val_t **, val_t *), val_t **env) {
  struct val *ret = (struct val *)malloc(sizeof(struct val));

  if (!ret) {
    err(1, "malloc error ;(");
  }

  ret->tag = CLOSURE_T;
  ret->c.code = code;
  ret->c.env = env;

  return ret;
}

struct val *build_int(int val) {
  struct val *ret = (struct val *)malloc(sizeof(struct val));

  if (!ret) {
    err(1, "malloc error ;(");
  }

  ret->tag = INT_T;
  ret->c.integer = val;

  return ret;
}

void print_val(val_t *val) {
  switch (val->tag) {
  case CLOSURE_T:
    printf("<#closure>\n");
  case INT_T:
    printf("%d\n", val->c.integer);
  default:
    return;
  }
}