#ifndef VAL_H
#define VAL_H

typedef enum { CLOSURE_T, INT_T } val_tag;

typedef struct val {
  val_tag tag;
  union {
    struct {
      struct val *(*code)(struct val **, struct val *);
      struct val **env;
    };
    int integer;
  } c;
} val_t;

val_t *build_cls(val_t *(*code)(val_t **, val_t *), val_t **env);
val_t *build_int(int val);
void destroy_val(val_t *val);
void print_val(val_t *val);

#endif /* VAL_H */
